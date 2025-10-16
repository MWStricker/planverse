-- Step 5: Enforce E2E encryption at database level
-- This migration handles legacy unencrypted messages and enforces encryption for all future messages

-- 1. Handle legacy unencrypted messages by marking them with placeholder values
UPDATE messages
SET 
  nonce = 'LEGACY_UNENCRYPTED',
  sender_device_id = 'LEGACY_UNENCRYPTED',
  is_encrypted = false
WHERE nonce IS NULL OR sender_device_id IS NULL;

-- 2. Now make nonce and sender_device_id NOT NULL
ALTER TABLE messages 
  ALTER COLUMN nonce SET NOT NULL;

ALTER TABLE messages 
  ALTER COLUMN sender_device_id SET NOT NULL;

-- 3. Create a stricter validation function that blocks new unencrypted messages
-- but allows legacy messages to exist
CREATE OR REPLACE FUNCTION validate_encrypted_message()
RETURNS TRIGGER AS $$
BEGIN
  -- For new messages (INSERT), enforce strict encryption
  IF TG_OP = 'INSERT' THEN
    -- BLOCK any new message that isn't properly encrypted
    IF NEW.is_encrypted = false THEN
      RAISE EXCEPTION 'Unencrypted messages are not allowed. All new messages must be end-to-end encrypted.';
    END IF;
    
    IF NEW.nonce IS NULL OR NEW.nonce = '' OR NEW.nonce = 'LEGACY_UNENCRYPTED' THEN
      RAISE EXCEPTION 'All new messages must be encrypted with a valid nonce';
    END IF;
    
    IF NEW.sender_device_id IS NULL OR NEW.sender_device_id = '' OR NEW.sender_device_id = 'LEGACY_UNENCRYPTED' THEN
      RAISE EXCEPTION 'Sender device ID is required for all new encrypted messages';
    END IF;
    
    -- Force is_encrypted to true for all new messages
    NEW.is_encrypted = true;
  END IF;
  
  -- For updates, prevent changing encryption status of legacy messages
  -- but still enforce encryption for non-legacy messages
  IF TG_OP = 'UPDATE' THEN
    IF OLD.nonce = 'LEGACY_UNENCRYPTED' THEN
      -- Don't allow modifying legacy message encryption status
      NEW.nonce = OLD.nonce;
      NEW.sender_device_id = OLD.sender_device_id;
      NEW.is_encrypted = OLD.is_encrypted;
    ELSE
      -- For encrypted messages, ensure they stay encrypted
      IF NEW.is_encrypted = false THEN
        RAISE EXCEPTION 'Cannot change encrypted messages to unencrypted';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Drop and recreate the trigger
DROP TRIGGER IF EXISTS check_encrypted_message ON messages;
CREATE TRIGGER check_encrypted_message
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_encrypted_message();

-- 5. Add index to help identify legacy messages
CREATE INDEX IF NOT EXISTS idx_messages_legacy 
  ON messages(nonce) 
  WHERE nonce = 'LEGACY_UNENCRYPTED';