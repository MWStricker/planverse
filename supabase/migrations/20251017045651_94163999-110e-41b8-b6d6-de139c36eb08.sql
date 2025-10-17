-- ============================================================================
-- RLS Performance Optimization: Replace direct auth calls with STABLE helpers
-- This resolves all "Auth RLS Initialization Plan" warnings by caching auth
-- values once per query instead of recalculating for every row
-- ============================================================================

-- PART 1: Create Optimized Auth Helper Functions
-- ============================================================================

-- Optimized function to get current user ID
-- STABLE: result won't change during a single query execution
-- SECURITY DEFINER: runs with owner privileges to access JWT claims
CREATE OR REPLACE FUNCTION public.auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'sub',
    nullif(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
$$;

-- Optimized function to get current user role
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'role',
    current_setting('role', true)
  )::text;
$$;

-- Optimized function to get current user email
CREATE OR REPLACE FUNCTION public.auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'email',
    ''
  )::text;
$$;

-- Update existing has_role function to use optimized auth_uid
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
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

-- ============================================================================
-- PART 2: Update All RLS Policies to Use Optimized Functions
-- ============================================================================

-- TABLE: profiles
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;
CREATE POLICY "Anyone can view public profiles"
ON public.profiles
FOR SELECT
USING (is_public = true OR public.auth_uid() = user_id);

-- TABLE: events
DROP POLICY IF EXISTS "Users can manage their own events" ON public.events;
CREATE POLICY "Users can manage their own events"
ON public.events
FOR ALL
USING (public.auth_uid() = user_id);

-- TABLE: tasks
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks"
ON public.tasks
FOR ALL
USING (public.auth_uid() = user_id);

-- TABLE: study_sessions
DROP POLICY IF EXISTS "Users can manage their own study sessions" ON public.study_sessions;
CREATE POLICY "Users can manage their own study sessions"
ON public.study_sessions
FOR ALL
USING (public.auth_uid() = user_id);

-- TABLE: ocr_uploads
DROP POLICY IF EXISTS "Users can manage their own OCR uploads" ON public.ocr_uploads;
CREATE POLICY "Users can manage their own OCR uploads"
ON public.ocr_uploads
FOR ALL
USING (public.auth_uid() = user_id);

-- TABLE: user_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own settings" ON public.user_settings;
CREATE POLICY "Users can create their own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own settings" ON public.user_settings;
CREATE POLICY "Users can delete their own settings"
ON public.user_settings
FOR DELETE
USING (public.auth_uid() = user_id);

-- TABLE: account_type_history
DROP POLICY IF EXISTS "Users can view their account history" ON public.account_type_history;
CREATE POLICY "Users can view their account history"
ON public.account_type_history
FOR SELECT
USING (public.auth_uid() = user_id);

-- TABLE: blocked_users
DROP POLICY IF EXISTS "Users can create blocks" ON public.blocked_users;
CREATE POLICY "Users can create blocks"
ON public.blocked_users
FOR INSERT
WITH CHECK (public.auth_uid() = blocker_id);

DROP POLICY IF EXISTS "Users can view their blocks" ON public.blocked_users;
CREATE POLICY "Users can view their blocks"
ON public.blocked_users
FOR SELECT
USING (public.auth_uid() = blocker_id);

DROP POLICY IF EXISTS "Users can delete their blocks" ON public.blocked_users;
CREATE POLICY "Users can delete their blocks"
ON public.blocked_users
FOR DELETE
USING (public.auth_uid() = blocker_id);

-- TABLE: calendar_connections
DROP POLICY IF EXISTS "Users can view their own calendar connections" ON public.calendar_connections;
CREATE POLICY "Users can view their own calendar connections"
ON public.calendar_connections
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own calendar connections" ON public.calendar_connections;
CREATE POLICY "Users can create their own calendar connections"
ON public.calendar_connections
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar connections" ON public.calendar_connections;
CREATE POLICY "Users can update their own calendar connections"
ON public.calendar_connections
FOR UPDATE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar connections" ON public.calendar_connections;
CREATE POLICY "Users can delete their own calendar connections"
ON public.calendar_connections
FOR DELETE
USING (public.auth_uid() = user_id);

-- TABLE: comments
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
CREATE POLICY "Users can create comments"
ON public.comments
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
CREATE POLICY "Users can update their own comments"
ON public.comments
FOR UPDATE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments"
ON public.comments
FOR DELETE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can view approved comments" ON public.comments;
CREATE POLICY "Users can view approved comments"
ON public.comments
FOR SELECT
USING (
  moderation_status IN ('approved', 'pending', 'flagged') 
  OR public.auth_uid() = user_id 
  OR has_role(public.auth_uid(), 'admin'::app_role) 
  OR has_role(public.auth_uid(), 'moderator'::app_role)
);

-- TABLE: conversations
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
USING (public.auth_uid() = user1_id OR public.auth_uid() = user2_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (public.auth_uid() = user1_id OR public.auth_uid() = user2_id);

DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
CREATE POLICY "Users can update their conversations"
ON public.conversations
FOR UPDATE
USING (public.auth_uid() = user1_id OR public.auth_uid() = user2_id);

-- TABLE: friend_requests
DROP POLICY IF EXISTS "Users can create friend requests" ON public.friend_requests;
CREATE POLICY "Users can create friend requests"
ON public.friend_requests
FOR INSERT
WITH CHECK (public.auth_uid() = sender_id);

DROP POLICY IF EXISTS "Users can view friend requests involving them" ON public.friend_requests;
CREATE POLICY "Users can view friend requests involving them"
ON public.friend_requests
FOR SELECT
USING (public.auth_uid() = sender_id OR public.auth_uid() = receiver_id);

DROP POLICY IF EXISTS "Users can update friend requests involving them" ON public.friend_requests;
CREATE POLICY "Users can update friend requests involving them"
ON public.friend_requests
FOR UPDATE
USING (public.auth_uid() = sender_id OR public.auth_uid() = receiver_id);

-- TABLE: friendships
DROP POLICY IF EXISTS "Users can view friendships they're part of" ON public.friendships;
CREATE POLICY "Users can view friendships they're part of"
ON public.friendships
FOR SELECT
USING (public.auth_uid() = user1_id OR public.auth_uid() = user2_id);

DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
CREATE POLICY "Users can create friendships"
ON public.friendships
FOR INSERT
WITH CHECK (public.auth_uid() = user1_id OR public.auth_uid() = user2_id);

-- TABLE: message_pins
DROP POLICY IF EXISTS "Users can view pins in their conversations" ON public.message_pins;
CREATE POLICY "Users can view pins in their conversations"
ON public.message_pins
FOR SELECT
USING (conversation_id IN (
  SELECT id FROM conversations 
  WHERE user1_id = public.auth_uid() OR user2_id = public.auth_uid()
));

DROP POLICY IF EXISTS "Users can pin messages" ON public.message_pins;
CREATE POLICY "Users can pin messages"
ON public.message_pins
FOR INSERT
WITH CHECK (conversation_id IN (
  SELECT id FROM conversations 
  WHERE user1_id = public.auth_uid() OR user2_id = public.auth_uid()
));

DROP POLICY IF EXISTS "Users can unpin messages" ON public.message_pins;
CREATE POLICY "Users can unpin messages"
ON public.message_pins
FOR DELETE
USING (pinned_by = public.auth_uid());

-- TABLE: messages
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
CREATE POLICY "Users can view messages they sent or received"
ON public.messages
FOR SELECT
USING (public.auth_uid() = sender_id OR public.auth_uid() = receiver_id);

DROP POLICY IF EXISTS "Users can create messages they send" ON public.messages;
CREATE POLICY "Users can create messages they send"
ON public.messages
FOR INSERT
WITH CHECK (public.auth_uid() = sender_id);

DROP POLICY IF EXISTS "Users can update messages they sent" ON public.messages;
CREATE POLICY "Users can update messages they sent"
ON public.messages
FOR UPDATE
USING (public.auth_uid() = sender_id);

-- TABLE: moderation_logs
DROP POLICY IF EXISTS "Admins and moderators can view logs" ON public.moderation_logs;
CREATE POLICY "Admins and moderators can view logs"
ON public.moderation_logs
FOR SELECT
USING (has_role(public.auth_uid(), 'admin'::app_role) OR has_role(public.auth_uid(), 'moderator'::app_role));

-- TABLE: notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (public.auth_uid() = user_id);

-- TABLE: post_analytics
DROP POLICY IF EXISTS "Users can view analytics for their own posts" ON public.post_analytics;
CREATE POLICY "Users can view analytics for their own posts"
ON public.post_analytics
FOR SELECT
USING (public.auth_uid() = user_id);

-- TABLE: post_likes
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.post_likes;
CREATE POLICY "Users can manage their own likes"
ON public.post_likes
FOR ALL
USING (public.auth_uid() = user_id)
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view post likes" ON public.post_likes;
CREATE POLICY "Authenticated users can view post likes"
ON public.post_likes
FOR SELECT
USING (public.auth_role() = 'authenticated' OR public.auth_role() = 'anon');

-- TABLE: posts
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts"
ON public.posts
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
ON public.posts
FOR UPDATE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
ON public.posts
FOR DELETE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can view posts based on privacy and moderation" ON public.posts;
CREATE POLICY "Users can view posts based on privacy and moderation"
ON public.posts
FOR SELECT
USING (
  (
    moderation_status IN ('approved', 'pending', 'flagged')
    OR public.auth_uid() = user_id
    OR has_role(public.auth_uid(), 'admin'::app_role)
    OR has_role(public.auth_uid(), 'moderator'::app_role)
  )
  AND (
    visibility = 'public'
    OR public.auth_uid() = user_id
    OR (visibility = 'school-only' AND EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.user_id = public.auth_uid()
        AND p2.user_id = posts.user_id
        AND p1.school = p2.school
        AND p1.school IS NOT NULL
    ))
    OR (visibility = 'major-only' AND EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.user_id = public.auth_uid()
        AND p2.user_id = posts.user_id
        AND p1.major = p2.major
        AND p1.major IS NOT NULL
    ))
    OR (visibility = 'friends-only' AND are_friends(public.auth_uid(), user_id))
  )
);

-- TABLE: promoted_posts
DROP POLICY IF EXISTS "Users can view their own promoted posts" ON public.promoted_posts;
CREATE POLICY "Users can view their own promoted posts"
ON public.promoted_posts
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can create promoted posts" ON public.promoted_posts;
CREATE POLICY "Users can create promoted posts"
ON public.promoted_posts
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own promoted posts" ON public.promoted_posts;
CREATE POLICY "Users can update their own promoted posts"
ON public.promoted_posts
FOR UPDATE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Admins/moderators can view all promoted posts" ON public.promoted_posts;
CREATE POLICY "Admins/moderators can view all promoted posts"
ON public.promoted_posts
FOR SELECT
USING (has_role(public.auth_uid(), 'admin'::app_role) OR has_role(public.auth_uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Admins/moderators can update promoted posts for moderation" ON public.promoted_posts;
CREATE POLICY "Admins/moderators can update promoted posts for moderation"
ON public.promoted_posts
FOR UPDATE
USING (has_role(public.auth_uid(), 'admin'::app_role) OR has_role(public.auth_uid(), 'moderator'::app_role));

-- TABLE: reactions
DROP POLICY IF EXISTS "Users can view reactions on messages they can see" ON public.reactions;
CREATE POLICY "Users can view reactions on messages they can see"
ON public.reactions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM messages
  WHERE messages.id = reactions.message_id
    AND (messages.sender_id = public.auth_uid() OR messages.receiver_id = public.auth_uid())
));

DROP POLICY IF EXISTS "Users can add their own reactions" ON public.reactions;
CREATE POLICY "Users can add their own reactions"
ON public.reactions
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reactions" ON public.reactions;
CREATE POLICY "Users can update their own reactions"
ON public.reactions
FOR UPDATE
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own reactions" ON public.reactions;
CREATE POLICY "Users can remove their own reactions"
ON public.reactions
FOR DELETE
USING (public.auth_uid() = user_id);

-- TABLE: user_accounts
DROP POLICY IF EXISTS "Users can view their own account" ON public.user_accounts;
CREATE POLICY "Users can view their own account"
ON public.user_accounts
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own account" ON public.user_accounts;
CREATE POLICY "Users can update their own account"
ON public.user_accounts
FOR UPDATE
USING (public.auth_uid() = user_id);

-- TABLE: user_interests
DROP POLICY IF EXISTS "Users can view their own interests" ON public.user_interests;
CREATE POLICY "Users can view their own interests"
ON public.user_interests
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can view public profile interests" ON public.user_interests;
CREATE POLICY "Users can view public profile interests"
ON public.user_interests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = user_interests.user_id
    AND profiles.is_public = true
));

DROP POLICY IF EXISTS "Users can insert their own interests" ON public.user_interests;
CREATE POLICY "Users can insert their own interests"
ON public.user_interests
FOR INSERT
WITH CHECK (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own interests" ON public.user_interests;
CREATE POLICY "Users can update their own interests"
ON public.user_interests
FOR UPDATE
USING (public.auth_uid() = user_id);

-- TABLE: user_presence
DROP POLICY IF EXISTS "Users can view their own presence" ON public.user_presence;
CREATE POLICY "Users can view their own presence"
ON public.user_presence
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Users can view friends presence" ON public.user_presence;
CREATE POLICY "Users can view friends presence"
ON public.user_presence
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM friendships
  WHERE (friendships.user1_id = public.auth_uid() AND friendships.user2_id = user_presence.user_id)
     OR (friendships.user2_id = public.auth_uid() AND friendships.user1_id = user_presence.user_id)
));

DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;
CREATE POLICY "Users can update their own presence"
ON public.user_presence
FOR ALL
USING (public.auth_uid() = user_id)
WITH CHECK (public.auth_uid() = user_id);

-- TABLE: user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (public.auth_uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(public.auth_uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (has_role(public.auth_uid(), 'admin'::app_role));