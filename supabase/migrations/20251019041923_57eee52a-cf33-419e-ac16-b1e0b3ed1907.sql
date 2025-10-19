-- =========================================================
-- Planverse Social Core - CRITICAL FIXES
-- Addresses 6 critical issues identified by TestSprite
-- =========================================================

-- ------------------------------------------------
-- ISSUE 2: Fix nullable counters
-- ------------------------------------------------
-- Update existing NULL values
UPDATE posts SET likes_count = 0 WHERE likes_count IS NULL;
UPDATE posts SET comments_count = 0 WHERE comments_count IS NULL;

-- Make columns NOT NULL
ALTER TABLE posts 
ALTER COLUMN likes_count SET NOT NULL,
ALTER COLUMN likes_count SET DEFAULT 0,
ALTER COLUMN comments_count SET NOT NULL,
ALTER COLUMN comments_count SET DEFAULT 0;

-- ------------------------------------------------
-- ISSUE 4: Ensure all foreign keys exist
-- ------------------------------------------------
-- Comments foreign keys (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'comments_post_id_fkey'
  ) THEN
    ALTER TABLE comments 
    ADD CONSTRAINT comments_post_id_fkey 
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'comments_user_id_fkey'
  ) THEN
    ALTER TABLE comments 
    ADD CONSTRAINT comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- post_likes foreign keys
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'post_likes_user_id_fkey'
  ) THEN
    ALTER TABLE post_likes 
    ADD CONSTRAINT post_likes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------
-- ISSUE 3: Add automatic count triggers
-- ------------------------------------------------
-- Function to increment comments count
CREATE OR REPLACE FUNCTION public.inc_comments_count()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts 
  SET comments_count = comments_count + 1 
  WHERE id = NEW.post_id;
  RETURN NEW;
END $$;

-- Function to increment likes count
CREATE OR REPLACE FUNCTION public.inc_likes_count()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts 
  SET likes_count = likes_count + 1 
  WHERE id = NEW.post_id;
  RETURN NEW;
END $$;

-- Function to decrement likes count
CREATE OR REPLACE FUNCTION public.dec_likes_count()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts 
  SET likes_count = GREATEST(likes_count - 1, 0) 
  WHERE id = OLD.post_id;
  RETURN OLD;
END $$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_comment_ins ON comments;
CREATE TRIGGER trg_comment_ins
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION inc_comments_count();

DROP TRIGGER IF EXISTS trg_like_ins ON post_likes;
CREATE TRIGGER trg_like_ins
AFTER INSERT ON post_likes
FOR EACH ROW EXECUTE FUNCTION inc_likes_count();

DROP TRIGGER IF EXISTS trg_like_del ON post_likes;
CREATE TRIGGER trg_like_del
AFTER DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION dec_likes_count();

-- ------------------------------------------------
-- Helper Function: can_view_post
-- (needed for visibility checks)
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_post(
  viewer uuid,
  author uuid,
  visibility text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profiles_exists boolean;
  friendships_exists boolean;
  same_school boolean := false;
  same_major boolean := false;
  are_friends boolean := false;
BEGIN
  -- Owner always can view
  IF viewer = author THEN
    RETURN true;
  END IF;

  -- Public posts always visible
  IF visibility = 'public' THEN
    RETURN true;
  END IF;

  -- Check if required tables exist
  profiles_exists := to_regclass('public.profiles') IS NOT NULL;
  friendships_exists := to_regclass('public.friendships') IS NOT NULL;

  -- School-only
  IF visibility = 'school-only' AND profiles_exists THEN
    SELECT EXISTS(
      SELECT 1
      FROM profiles me
      JOIN profiles au ON au.user_id = author
      WHERE me.user_id = viewer
        AND me.school IS NOT NULL
        AND me.school = au.school
    ) INTO same_school;
    IF same_school THEN
      RETURN true;
    END IF;
  END IF;

  -- Major-only
  IF visibility = 'major-only' AND profiles_exists THEN
    SELECT EXISTS(
      SELECT 1
      FROM profiles me
      JOIN profiles au ON au.user_id = author
      WHERE me.user_id = viewer
        AND me.major IS NOT NULL
        AND me.major = au.major
    ) INTO same_major;
    IF same_major THEN
      RETURN true;
    END IF;
  END IF;

  -- Friends-only (using user1_id/user2_id structure)
  IF visibility = 'friends-only' AND friendships_exists THEN
    SELECT EXISTS(
      SELECT 1
      FROM friendships f
      WHERE (
        (f.user1_id = LEAST(viewer, author) AND f.user2_id = GREATEST(viewer, author))
      )
    ) INTO are_friends;
    IF are_friends THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END $$;

-- ------------------------------------------------
-- ISSUES 5 & 6: Fix RLS Policies
-- ------------------------------------------------
-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view posts based on privacy and moderation" ON posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "read posts (approved + visibility)" ON posts;
DROP POLICY IF EXISTS "create own posts" ON posts;
DROP POLICY IF EXISTS "update own posts" ON posts;
DROP POLICY IF EXISTS "delete own posts" ON posts;

DROP POLICY IF EXISTS "Users can view approved comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
DROP POLICY IF EXISTS "read comments (approved + parent visible)" ON comments;
DROP POLICY IF EXISTS "create own comments" ON comments;
DROP POLICY IF EXISTS "update own comments" ON comments;
DROP POLICY IF EXISTS "delete own comments" ON comments;

DROP POLICY IF EXISTS "Users can view all post likes" ON post_likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON post_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON post_likes;
DROP POLICY IF EXISTS "Users can update their own likes" ON post_likes;
DROP POLICY IF EXISTS "read likes" ON post_likes;
DROP POLICY IF EXISTS "like as yourself" ON post_likes;
DROP POLICY IF EXISTS "unlike your like" ON post_likes;

-- POSTS: New secure policies
CREATE POLICY "read posts (approved + visibility)"
ON posts
FOR SELECT
TO authenticated
USING (
  -- Owner can read own posts (any moderation status)
  public.auth_uid() = user_id
  OR
  -- Others: only approved posts that pass visibility check
  (
    moderation_status = 'approved'
    AND can_view_post(public.auth_uid(), user_id, visibility)
  )
  OR
  -- Admins/moderators can see all
  public.has_role(public.auth_uid(), 'admin'::app_role)
  OR
  public.has_role(public.auth_uid(), 'moderator'::app_role)
);

CREATE POLICY "create own posts"
ON posts
FOR INSERT
TO authenticated
WITH CHECK (public.auth_uid() = user_id);

CREATE POLICY "update own posts"
ON posts
FOR UPDATE
TO authenticated
USING (public.auth_uid() = user_id)
WITH CHECK (public.auth_uid() = user_id);

CREATE POLICY "delete own posts"
ON posts
FOR DELETE
TO authenticated
USING (public.auth_uid() = user_id);

-- COMMENTS: New secure policies
CREATE POLICY "read comments (approved + parent visible)"
ON comments
FOR SELECT
TO authenticated
USING (
  -- Owner can read own comments
  public.auth_uid() = user_id
  OR
  -- Others: only approved comments on approved visible posts
  (
    moderation_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = comments.post_id
        AND p.moderation_status = 'approved'
        AND can_view_post(public.auth_uid(), p.user_id, p.visibility)
    )
  )
  OR
  -- Admins/moderators can see all
  public.has_role(public.auth_uid(), 'admin'::app_role)
  OR
  public.has_role(public.auth_uid(), 'moderator'::app_role)
);

CREATE POLICY "create own comments"
ON comments
FOR INSERT
TO authenticated
WITH CHECK (public.auth_uid() = user_id);

CREATE POLICY "update own comments"
ON comments
FOR UPDATE
TO authenticated
USING (public.auth_uid() = user_id)
WITH CHECK (public.auth_uid() = user_id);

CREATE POLICY "delete own comments"
ON comments
FOR DELETE
TO authenticated
USING (public.auth_uid() = user_id);

-- POST_LIKES: Simple policies
CREATE POLICY "read likes"
ON post_likes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "like as yourself"
ON post_likes
FOR INSERT
TO authenticated
WITH CHECK (public.auth_uid() = user_id);

CREATE POLICY "unlike your like"
ON post_likes
FOR DELETE
TO authenticated
USING (public.auth_uid() = user_id);

-- ------------------------------------------------
-- CODE CLEANUP: Deprecate manual RPC functions
-- ------------------------------------------------
-- Mark old functions as deprecated (keep for backward compatibility)
COMMENT ON FUNCTION increment_likes_count IS 'DEPRECATED: Use automatic triggers instead';
COMMENT ON FUNCTION decrement_likes_count IS 'DEPRECATED: Use automatic triggers instead';
COMMENT ON FUNCTION increment_comments_count IS 'DEPRECATED: Use automatic triggers instead';