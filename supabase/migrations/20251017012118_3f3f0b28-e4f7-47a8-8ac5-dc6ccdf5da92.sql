-- Phase 1: Block Users, Post Privacy, Realtime Notifications, Image Upload

-- ================================
-- 1. BLOCK USERS SYSTEM
-- ================================

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id) -- Can't block yourself
);

-- RLS Policies for blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create blocks"
  ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can view their blocks"
  ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their blocks"
  ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Index for performance
CREATE INDEX idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- ================================
-- 2. POST PRIVACY ENFORCEMENT
-- ================================

-- Create helper function to check if users are friends
CREATE OR REPLACE FUNCTION public.are_friends(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user1_id = $1 AND user2_id = $2)
       OR (user1_id = $2 AND user2_id = $1)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Update posts RLS policy for privacy enforcement
DROP POLICY IF EXISTS "Users can view approved posts" ON public.posts;

CREATE POLICY "Users can view posts based on privacy and moderation"
  ON public.posts FOR SELECT
  USING (
    -- Post must be approved/pending/flagged (moderation check)
    (moderation_status IN ('approved', 'pending', 'flagged')
     OR auth.uid() = user_id
     OR has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'moderator'))
    AND
    -- Privacy check
    (
      visibility = 'public'
      OR auth.uid() = user_id -- Always see own posts
      OR (visibility = 'school-only' AND EXISTS (
        SELECT 1 FROM profiles p1, profiles p2
        WHERE p1.user_id = auth.uid()
          AND p2.user_id = posts.user_id
          AND p1.school = p2.school
          AND p1.school IS NOT NULL
      ))
      OR (visibility = 'major-only' AND EXISTS (
        SELECT 1 FROM profiles p1, profiles p2
        WHERE p1.user_id = auth.uid()
          AND p2.user_id = posts.user_id
          AND p1.major = p2.major
          AND p1.major IS NOT NULL
      ))
      OR (visibility = 'friends-only' AND are_friends(auth.uid(), posts.user_id))
    )
  );

-- ================================
-- 3. POST EDITING SUPPORT
-- ================================

-- Add edited_at column to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;