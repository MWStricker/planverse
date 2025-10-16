-- Fix security warnings: Set search_path for trigger functions

-- Drop and recreate update_promoted_posts_updated_at with search_path
DROP FUNCTION IF EXISTS update_promoted_posts_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION update_promoted_posts_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop and recreate update_post_analytics_updated_at with search_path
DROP FUNCTION IF EXISTS update_post_analytics_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION update_post_analytics_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER trigger_update_promoted_posts_updated_at
  BEFORE UPDATE ON promoted_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_promoted_posts_updated_at();

CREATE TRIGGER trigger_update_post_analytics_updated_at
  BEFORE UPDATE ON post_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_updated_at();