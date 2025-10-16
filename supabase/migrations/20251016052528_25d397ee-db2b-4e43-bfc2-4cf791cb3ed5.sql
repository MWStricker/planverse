-- Add client_msg_id for idempotency
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_msg_id TEXT;

-- Create unique index to prevent duplicates (per sender)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id 
ON messages(sender_id, client_msg_id) 
WHERE client_msg_id IS NOT NULL;

-- Add seq_num for authoritative ordering
ALTER TABLE messages ADD COLUMN IF NOT EXISTS seq_num BIGSERIAL;

-- Create index for fast ordering queries
CREATE INDEX IF NOT EXISTS idx_messages_seq 
ON messages(seq_num);

-- Add index for conversation-specific ordering
CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq 
ON messages(sender_id, receiver_id, seq_num);

-- Update existing messages to have seq_num based on created_at order
DO $$
DECLARE
  msg RECORD;
  seq BIGINT := 1;
BEGIN
  FOR msg IN 
    SELECT id FROM messages ORDER BY created_at ASC
  LOOP
    UPDATE messages SET seq_num = seq WHERE id = msg.id;
    seq := seq + 1;
  END LOOP;
END $$;

-- Make seq_num NOT NULL after backfilling
ALTER TABLE messages ALTER COLUMN seq_num SET NOT NULL;