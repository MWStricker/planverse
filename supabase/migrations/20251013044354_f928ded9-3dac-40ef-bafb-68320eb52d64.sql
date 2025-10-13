-- Create app_role enum for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table (security requirement: separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create moderation_status enum
CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected', 'flagged', 'auto_hidden');

-- Add moderation columns to posts table
ALTER TABLE public.posts
  ADD COLUMN moderation_status moderation_status DEFAULT 'pending',
  ADD COLUMN moderation_score INTEGER,
  ADD COLUMN moderation_flags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN moderated_at TIMESTAMPTZ,
  ADD COLUMN moderated_by UUID REFERENCES auth.users(id);

-- Add moderation columns to comments table
ALTER TABLE public.comments
  ADD COLUMN moderation_status moderation_status DEFAULT 'pending',
  ADD COLUMN moderation_score INTEGER,
  ADD COLUMN moderation_flags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN moderated_at TIMESTAMPTZ,
  ADD COLUMN moderated_by UUID REFERENCES auth.users(id);

-- Create moderation_logs table
CREATE TABLE public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  moderator_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('auto_moderate', 'approve', 'reject', 'flag')),
  moderation_score INTEGER,
  moderation_flags JSONB DEFAULT '[]'::jsonb,
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- RLS for moderation_logs
CREATE POLICY "Admins and moderators can view logs"
  ON public.moderation_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "System can insert logs"
  ON public.moderation_logs FOR INSERT
  WITH CHECK (true);

-- Update posts RLS to hide auto-hidden content from regular users
CREATE POLICY "Users can view approved posts"
  ON public.posts FOR SELECT
  USING (
    moderation_status IN ('approved', 'pending', 'flagged') OR
    auth.uid() = user_id OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'moderator')
  );

-- Drop old posts policy
DROP POLICY IF EXISTS "Authenticated users can view posts" ON public.posts;

-- Update comments RLS similarly
CREATE POLICY "Users can view approved comments"
  ON public.comments FOR SELECT
  USING (
    moderation_status IN ('approved', 'pending', 'flagged') OR
    auth.uid() = user_id OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'moderator')
  );

-- Drop old comments policy
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.comments;