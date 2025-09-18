-- Add new columns to posts table for enhanced posting features
ALTER TABLE public.posts 
ADD COLUMN target_major TEXT,
ADD COLUMN target_community TEXT,
ADD COLUMN post_type TEXT DEFAULT 'general' CHECK (post_type IN ('general', 'academic', 'social', 'announcement', 'question', 'study-group')),
ADD COLUMN visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'major-only', 'school-only', 'friends-only')),
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Add indexes for better performance
CREATE INDEX idx_posts_target_major ON public.posts(target_major);
CREATE INDEX idx_posts_target_community ON public.posts(target_community);
CREATE INDEX idx_posts_post_type ON public.posts(post_type);
CREATE INDEX idx_posts_visibility ON public.posts(visibility);
CREATE INDEX idx_posts_tags ON public.posts USING GIN(tags);