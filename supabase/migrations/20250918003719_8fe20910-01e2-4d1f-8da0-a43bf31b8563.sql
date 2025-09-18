-- Remove the function that clears plaintext tokens as it's preventing sync from working
DROP FUNCTION IF EXISTS public.calendar_connections_clear_plaintext();