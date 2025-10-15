-- Add encryption fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS key_fingerprint TEXT;

-- Add encryption metadata to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS nonce TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT true;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_device_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_counter BIGINT;

-- Create index for message ordering and replay protection
CREATE INDEX IF NOT EXISTS idx_messages_counter ON messages(sender_id, receiver_id, message_counter);

-- Comment existing content column as it now stores encrypted ciphertext
COMMENT ON COLUMN messages.content IS 'Stores encrypted ciphertext when is_encrypted=true';