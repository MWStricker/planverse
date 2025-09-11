-- Create functions to update post counts
CREATE OR REPLACE FUNCTION public.increment_likes_count(post_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.posts 
  SET likes_count = likes_count + 1 
  WHERE id = post_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_likes_count(post_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.posts 
  SET likes_count = GREATEST(likes_count - 1, 0) 
  WHERE id = post_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_comments_count(post_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.posts 
  SET comments_count = comments_count + 1 
  WHERE id = post_id;
$$;