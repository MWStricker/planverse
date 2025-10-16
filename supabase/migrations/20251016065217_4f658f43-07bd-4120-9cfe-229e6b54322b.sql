-- Add display_order for custom conversation sorting
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Add unread_count to track unread messages per conversation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_display_order ON conversations(display_order);