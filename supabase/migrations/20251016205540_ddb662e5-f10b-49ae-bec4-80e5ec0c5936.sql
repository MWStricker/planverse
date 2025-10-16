-- Add user-specific pin and mute columns to conversations table
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS user1_is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS user2_is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS user1_is_muted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS user2_is_muted boolean DEFAULT false;

-- Migrate existing data to new columns
UPDATE public.conversations
SET 
  user1_is_pinned = COALESCE(is_pinned, false),
  user2_is_pinned = COALESCE(is_pinned, false),
  user1_is_muted = COALESCE(is_muted, false),
  user2_is_muted = COALESCE(is_muted, false)
WHERE user1_is_pinned IS NULL OR user2_is_pinned IS NULL 
   OR user1_is_muted IS NULL OR user2_is_muted IS NULL;

-- Keep old columns for backwards compatibility
-- We can remove them in a future migration after testing
COMMENT ON COLUMN public.conversations.is_pinned IS 'Deprecated: Use user1_is_pinned and user2_is_pinned instead';
COMMENT ON COLUMN public.conversations.is_muted IS 'Deprecated: Use user1_is_muted and user2_is_muted instead';