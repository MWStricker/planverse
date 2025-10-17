-- First, clean up orphaned comments (comments from users without profiles)
DELETE FROM public.comments 
WHERE user_id NOT IN (SELECT user_id FROM public.profiles);

-- Clean up orphaned posts (posts from users without profiles)
DELETE FROM public.posts 
WHERE user_id NOT IN (SELECT user_id FROM public.profiles);

-- Now add the foreign key constraints
ALTER TABLE public.posts 
ADD CONSTRAINT posts_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

ALTER TABLE public.comments
ADD CONSTRAINT comments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Add performance indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON public.posts(moderation_status);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user1_user2 ON public.friendships(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_blocked ON public.blocked_users(blocker_id, blocked_id);