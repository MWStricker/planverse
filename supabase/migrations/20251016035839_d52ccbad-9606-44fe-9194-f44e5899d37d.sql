-- Mark old messages without nonce as unencrypted
UPDATE messages 
SET is_encrypted = false 
WHERE is_encrypted = true 
  AND (nonce IS NULL OR nonce = '');

-- Add constraint to prevent future inconsistencies
-- Using a trigger instead of CHECK constraint for better compatibility
CREATE OR REPLACE FUNCTION validate_encrypted_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_encrypted = true AND (NEW.nonce IS NULL OR NEW.nonce = '') THEN
    RAISE EXCEPTION 'Encrypted messages must have a nonce';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_encrypted_has_nonce ON messages;
CREATE TRIGGER ensure_encrypted_has_nonce
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_encrypted_message();