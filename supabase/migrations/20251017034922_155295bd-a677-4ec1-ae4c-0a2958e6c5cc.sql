-- Clean up orphaned post_likes records (likes for non-existent posts)
DELETE FROM post_likes
WHERE post_id NOT IN (SELECT id FROM posts);

-- Clean up orphaned comments records (comments for non-existent posts)
DELETE FROM comments
WHERE post_id NOT IN (SELECT id FROM posts);

-- Add foreign key from post_likes to posts
ALTER TABLE post_likes
ADD CONSTRAINT post_likes_post_id_fkey 
FOREIGN KEY (post_id) 
REFERENCES posts(id) 
ON DELETE CASCADE;

-- Add foreign key from comments to posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'comments_post_id_fkey'
  ) THEN
    ALTER TABLE comments
    ADD CONSTRAINT comments_post_id_fkey 
    FOREIGN KEY (post_id) 
    REFERENCES posts(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Force PostgREST schema cache reload
CREATE TABLE IF NOT EXISTS _cache_bust_post_fks (id INT);
DROP TABLE IF EXISTS _cache_bust_post_fks;