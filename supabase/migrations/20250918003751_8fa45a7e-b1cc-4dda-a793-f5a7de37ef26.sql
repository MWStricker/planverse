-- Drop the trigger and function that clear access tokens
DROP TRIGGER IF EXISTS trg_clear_plaintext_tokens ON calendar_connections;
DROP FUNCTION IF EXISTS public.calendar_connections_clear_plaintext();