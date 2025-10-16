-- Phase 1: Database Schema Changes for Professional Accounts & Post Promotion

-- 1. Add Professional Account Fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'professional')),
ADD COLUMN IF NOT EXISTS upgraded_to_professional_at timestamp with time zone;

-- 2. Create promoted_posts table
CREATE TABLE IF NOT EXISTS promoted_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  -- Pricing & Payment
  promotion_budget numeric NOT NULL CHECK (promotion_budget >= 5.00 AND promotion_budget <= 1000.00),
  stripe_payment_intent_id text,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  
  -- Promotion Settings
  promotion_duration_days integer NOT NULL DEFAULT 7,
  target_impressions integer,
  target_engagement_rate numeric,
  
  -- Campaign Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'cancelled')),
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  moderation_notes text,
  moderated_by uuid,
  moderated_at timestamp with time zone,
  
  -- Performance Metrics
  total_impressions integer DEFAULT 0,
  total_clicks integer DEFAULT 0,
  total_likes integer DEFAULT 0,
  total_comments integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  
  -- Dates
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(post_id),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

-- Indexes for promoted_posts
CREATE INDEX IF NOT EXISTS idx_promoted_posts_user_id ON promoted_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_promoted_posts_status ON promoted_posts(status);
CREATE INDEX IF NOT EXISTS idx_promoted_posts_active ON promoted_posts(status, starts_at, ends_at) WHERE status = 'active';

-- Enable RLS on promoted_posts
ALTER TABLE promoted_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promoted_posts
CREATE POLICY "Users can view their own promoted posts"
  ON promoted_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create promoted posts"
  ON promoted_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own promoted posts"
  ON promoted_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins/moderators can view all promoted posts"
  ON promoted_posts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins/moderators can update promoted posts for moderation"
  ON promoted_posts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- 3. Create post_analytics table
CREATE TABLE IF NOT EXISTS post_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  -- Daily metrics
  date date NOT NULL,
  impressions integer DEFAULT 0,
  unique_viewers integer DEFAULT 0,
  clicks integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  
  -- Demographics (optional - for later)
  viewer_schools jsonb DEFAULT '[]'::jsonb,
  viewer_majors jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(post_id, date)
);

-- Indexes for post_analytics
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_user_id ON post_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_date ON post_analytics(date);

-- Enable RLS on post_analytics
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_analytics
CREATE POLICY "Users can view analytics for their own posts"
  ON post_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert analytics"
  ON post_analytics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update analytics"
  ON post_analytics FOR UPDATE
  USING (true);

-- 4. Add promotion fields to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS is_promoted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS promotion_priority numeric DEFAULT 0;

-- Index for promoted posts
CREATE INDEX IF NOT EXISTS idx_posts_promoted ON posts(is_promoted, promotion_priority) WHERE is_promoted = true;

-- 5. Create trigger to update updated_at on promoted_posts
CREATE OR REPLACE FUNCTION update_promoted_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_promoted_posts_updated_at
  BEFORE UPDATE ON promoted_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_promoted_posts_updated_at();

-- 6. Create trigger to update updated_at on post_analytics
CREATE OR REPLACE FUNCTION update_post_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_analytics_updated_at
  BEFORE UPDATE ON post_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_updated_at();