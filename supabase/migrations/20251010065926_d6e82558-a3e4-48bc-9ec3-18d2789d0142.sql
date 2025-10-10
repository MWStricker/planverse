-- Create user_interests table for onboarding questionnaire data
CREATE TABLE public.user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Always asked questions
  music_preference TEXT NOT NULL,
  music_genres JSONB DEFAULT '[]'::jsonb,
  
  -- Randomly selected questions (store which questions were asked)
  questions_asked JSONB NOT NULL,
  
  -- Answers to the random questions
  year_in_school TEXT,
  campus_hangout_spots TEXT[],
  clubs_and_events TEXT[],
  passion_outside_school TEXT,
  reason_for_school TEXT,
  
  -- Metadata
  onboarding_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own interests"
  ON public.user_interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interests"
  ON public.user_interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interests"
  ON public.user_interests FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for matching: users can view interests of public profiles
CREATE POLICY "Users can view public profile interests"
  ON public.user_interests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = user_interests.user_id
      AND profiles.is_public = true
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_user_interests_updated_at
  BEFORE UPDATE ON public.user_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add onboarding flags to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Create matching score function
CREATE OR REPLACE FUNCTION public.calculate_interest_match_score(
  user1_id UUID,
  user2_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  user1_interests RECORD;
  user2_interests RECORD;
  match_score NUMERIC := 0;
  shared_count INTEGER := 0;
  total_weight NUMERIC := 0;
BEGIN
  -- Fetch both users' interests
  SELECT * INTO user1_interests FROM public.user_interests WHERE user_id = user1_id;
  SELECT * INTO user2_interests FROM public.user_interests WHERE user_id = user2_id;
  
  IF user1_interests IS NULL OR user2_interests IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Music preference match (weight: 30 points)
  total_weight := total_weight + 30;
  IF user1_interests.music_preference = user2_interests.music_preference THEN
    match_score := match_score + 30;
  ELSIF user1_interests.music_genres IS NOT NULL AND user2_interests.music_genres IS NOT NULL THEN
    -- Check for overlapping genres
    SELECT COUNT(*) INTO shared_count
    FROM jsonb_array_elements_text(user1_interests.music_genres) AS g1
    INNER JOIN jsonb_array_elements_text(user2_interests.music_genres) AS g2 ON g1 = g2;
    
    IF shared_count > 0 THEN
      match_score := match_score + 15;
    END IF;
  END IF;
  
  -- Year in school match (weight: 15 points)
  IF user1_interests.year_in_school IS NOT NULL AND user2_interests.year_in_school IS NOT NULL THEN
    total_weight := total_weight + 15;
    IF user1_interests.year_in_school = user2_interests.year_in_school THEN
      match_score := match_score + 15;
    END IF;
  END IF;
  
  -- Campus hangout spots overlap (weight: 20 points)
  IF user1_interests.campus_hangout_spots IS NOT NULL AND user2_interests.campus_hangout_spots IS NOT NULL THEN
    total_weight := total_weight + 20;
    SELECT COUNT(*) INTO shared_count
    FROM unnest(user1_interests.campus_hangout_spots) AS spot1
    INNER JOIN unnest(user2_interests.campus_hangout_spots) AS spot2 ON spot1 = spot2;
    
    IF shared_count > 0 THEN
      match_score := match_score + (20 * LEAST(shared_count::NUMERIC / 3, 1));
    END IF;
  END IF;
  
  -- Clubs and events overlap (weight: 20 points)
  IF user1_interests.clubs_and_events IS NOT NULL AND user2_interests.clubs_and_events IS NOT NULL THEN
    total_weight := total_weight + 20;
    SELECT COUNT(*) INTO shared_count
    FROM unnest(user1_interests.clubs_and_events) AS club1
    INNER JOIN unnest(user2_interests.clubs_and_events) AS club2 ON club1 = club2;
    
    IF shared_count > 0 THEN
      match_score := match_score + (20 * LEAST(shared_count::NUMERIC / 2, 1));
    END IF;
  END IF;
  
  -- Passion text similarity (weight: 15 points)
  IF user1_interests.passion_outside_school IS NOT NULL AND user2_interests.passion_outside_school IS NOT NULL THEN
    total_weight := total_weight + 15;
    IF user1_interests.passion_outside_school ILIKE '%' || user2_interests.passion_outside_school || '%'
       OR user2_interests.passion_outside_school ILIKE '%' || user1_interests.passion_outside_school || '%' THEN
      match_score := match_score + 15;
    END IF;
  END IF;
  
  -- Normalize score to 0-100 range
  IF total_weight > 0 THEN
    RETURN (match_score / total_weight) * 100;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function to get suggested matches
CREATE OR REPLACE FUNCTION public.get_suggested_matches(
  target_user_id UUID,
  match_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  match_score NUMERIC,
  display_name TEXT,
  avatar_url TEXT,
  school TEXT,
  major TEXT,
  shared_interests JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    public.calculate_interest_match_score(target_user_id, p.user_id) AS match_score,
    p.display_name,
    p.avatar_url,
    p.school,
    p.major,
    jsonb_build_object(
      'music', ui.music_preference,
      'year', ui.year_in_school,
      'clubs', ui.clubs_and_events
    ) AS shared_interests
  FROM public.profiles p
  INNER JOIN public.user_interests ui ON ui.user_id = p.user_id
  WHERE p.user_id != target_user_id
    AND p.is_public = true
    AND ui.onboarding_completed = true
    AND p.user_id NOT IN (
      SELECT user2_id FROM public.friendships WHERE user1_id = target_user_id
      UNION
      SELECT user1_id FROM public.friendships WHERE user2_id = target_user_id
    )
  ORDER BY match_score DESC, p.created_at DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;