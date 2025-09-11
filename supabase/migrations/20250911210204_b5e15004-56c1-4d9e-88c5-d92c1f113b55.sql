-- Check all constraints on the table more directly
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'calendar_connections'::regclass;

-- Based on the error mentioning calendar_connections_provider_check, let's try to drop it if it exists
ALTER TABLE public.calendar_connections DROP CONSTRAINT IF EXISTS calendar_connections_provider_check;

-- Now try a test insert with canvas
INSERT INTO public.calendar_connections (user_id, provider, provider_id, sync_settings, is_active)
VALUES ('48635c24-cb68-4b1c-8533-7a81576c6701', 'canvas', 'test-url', '{}', true);

-- Check if that worked
SELECT * FROM public.calendar_connections WHERE provider = 'canvas';

-- Clean up the test data
DELETE FROM public.calendar_connections WHERE provider = 'canvas';