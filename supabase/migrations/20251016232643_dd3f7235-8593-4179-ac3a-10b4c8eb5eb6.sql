-- Add promotion_config column to promoted_posts table
ALTER TABLE promoted_posts 
ADD COLUMN IF NOT EXISTS promotion_config JSONB DEFAULT '{}'::jsonb;