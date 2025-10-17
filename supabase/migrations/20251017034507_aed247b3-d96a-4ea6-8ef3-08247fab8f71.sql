-- Force PostgREST schema cache reload
-- Creating and dropping a table triggers an immediate schema reload
CREATE TABLE IF NOT EXISTS _cache_bust_reload (id INT);
DROP TABLE IF EXISTS _cache_bust_reload;

-- Verify the foreign keys exist (they should already be there from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'posts_user_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Foreign key posts_user_id_fkey not found!';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'comments_user_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Foreign key comments_user_id_fkey not found!';
  END IF;
END $$;