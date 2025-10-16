-- Phase 1: Remove E2E Encryption from Database

-- Drop the encryption validation function and trigger
DROP TRIGGER IF EXISTS validate_message_encryption ON public.messages;
DROP FUNCTION IF EXISTS public.validate_encrypted_message() CASCADE;

-- Remove encryption-specific columns from messages table
ALTER TABLE public.messages 
  DROP COLUMN IF EXISTS is_encrypted,
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS sender_device_id,
  DROP COLUMN IF EXISTS message_counter;

-- Remove encryption key columns from profiles table
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS public_key,
  DROP COLUMN IF EXISTS device_id,
  DROP COLUMN IF EXISTS key_fingerprint;