-- Create user_streaks table for simple streak tracking
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own streak data"
  ON public.user_streaks
  FOR SELECT
  USING (auth_uid() = user_id);

CREATE POLICY "Users can insert their own streak data"
  ON public.user_streaks
  FOR INSERT
  WITH CHECK (auth_uid() = user_id);

CREATE POLICY "Users can update their own streak data"
  ON public.user_streaks
  FOR UPDATE
  USING (auth_uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();