-- Fix Multiple Permissive Policies and Remaining Warnings
-- This migration consolidates overlapping RLS policies and removes duplicate indexes

-- ============================================================================
-- 1. FIX POST_LIKES TABLE - Consolidate policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Authenticated users can view post likes" ON public.post_likes;

CREATE POLICY "Users can view all post likes"
ON public.post_likes
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own likes"
ON public.post_likes
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

CREATE POLICY "Users can delete their own likes"
ON public.post_likes
FOR DELETE
USING (public.auth_uid() = user_id);

CREATE POLICY "Users can update their own likes"
ON public.post_likes
FOR UPDATE
USING (public.auth_uid() = user_id);

-- ============================================================================
-- 2. FIX PROFILES TABLE - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  is_public = true 
  OR public.auth_uid() = user_id
);

-- ============================================================================
-- 3. FIX PROMOTED_POSTS TABLE - Consolidate policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own promoted posts" ON public.promoted_posts;
DROP POLICY IF EXISTS "Admins/moderators can view all promoted posts" ON public.promoted_posts;
DROP POLICY IF EXISTS "Users can update their own promoted posts" ON public.promoted_posts;
DROP POLICY IF EXISTS "Admins/moderators can update promoted posts for moderation" ON public.promoted_posts;

CREATE POLICY "Users and admins can view promoted posts"
ON public.promoted_posts
FOR SELECT
USING (
  public.auth_uid() = user_id
  OR public.has_role(public.auth_uid(), 'admin'::app_role)
  OR public.has_role(public.auth_uid(), 'moderator'::app_role)
);

CREATE POLICY "Users and admins can update promoted posts"
ON public.promoted_posts
FOR UPDATE
USING (
  public.auth_uid() = user_id
  OR public.has_role(public.auth_uid(), 'admin'::app_role)
  OR public.has_role(public.auth_uid(), 'moderator'::app_role)
);

-- ============================================================================
-- 4. FIX USER_INTERESTS TABLE - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own interests" ON public.user_interests;
DROP POLICY IF EXISTS "Users can view public profile interests" ON public.user_interests;

CREATE POLICY "Users can view interests"
ON public.user_interests
FOR SELECT
USING (
  public.auth_uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = user_interests.user_id
      AND profiles.is_public = true
  )
);

-- ============================================================================
-- 5. FIX USER_PRESENCE TABLE - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can view friends presence" ON public.user_presence;

CREATE POLICY "Users can view presence"
ON public.user_presence
FOR SELECT
USING (
  public.auth_uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (friendships.user1_id = public.auth_uid() AND friendships.user2_id = user_presence.user_id)
       OR (friendships.user2_id = public.auth_uid() AND friendships.user1_id = user_presence.user_id)
  )
);

-- ============================================================================
-- 6. FIX USER_ROLES TABLE - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Users and admins can view roles"
ON public.user_roles
FOR SELECT
USING (
  public.auth_uid() = user_id
  OR public.has_role(public.auth_uid(), 'admin'::app_role)
);

-- ============================================================================
-- 7. FIX POST_VIEWS TABLE - Update to use public.auth_uid()
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their post views" ON public.post_views;

CREATE POLICY "Users can view their post views"
ON public.post_views
FOR SELECT
USING (
  post_id IN (
    SELECT posts.id
    FROM public.posts
    WHERE posts.user_id = public.auth_uid()
  )
);

-- ============================================================================
-- 8. REMOVE DUPLICATE INDEXES
-- ============================================================================

-- Drop duplicate composite index on friendships (keeping idx_friendships_user1_user2)
DROP INDEX IF EXISTS public.idx_friendships_users;

-- Drop simpler index on messages (keeping idx_messages_conversation which is more specific)
DROP INDEX IF EXISTS public.idx_messages_sender_receiver;