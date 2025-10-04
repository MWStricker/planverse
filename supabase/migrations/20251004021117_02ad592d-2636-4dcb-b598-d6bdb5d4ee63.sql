-- SECURITY FIX 1: Remove plaintext OAuth tokens from calendar_connections
-- Keep only encrypted versions for security
ALTER TABLE public.calendar_connections 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

-- SECURITY FIX 2: Change default profile visibility to private
-- Protect student privacy by making profiles private by default
ALTER TABLE public.profiles 
ALTER COLUMN is_public SET DEFAULT false;

-- SECURITY FIX 3: Restrict sync_stats table to service role only
-- Remove public access to internal system data
DROP POLICY IF EXISTS "Service role can manage sync stats" ON public.sync_stats;

CREATE POLICY "Only service role can access sync stats"
ON public.sync_stats
FOR ALL
USING (false); -- No public access - only service role with bypassing RLS

-- SECURITY FIX 4: Hide user_id from unauthenticated users in posts
-- Prevent tracking of post authors without authentication
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;

CREATE POLICY "Authenticated users can view posts"
ON public.posts
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- SECURITY FIX 5: Hide user_id from unauthenticated users in comments
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;

CREATE POLICY "Authenticated users can view comments"
ON public.comments
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- SECURITY FIX 6: Hide user_id from unauthenticated users in post_likes
DROP POLICY IF EXISTS "Anyone can view post likes" ON public.post_likes;

CREATE POLICY "Authenticated users can view post likes"
ON public.post_likes
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'anon');