-- Let's test if auth.uid() is working at all
-- First, let's check what auth.uid() returns for this user
SELECT auth.uid() as current_user_id;

-- Let's temporarily disable RLS to test if the table works without it
ALTER TABLE public.calendar_connections DISABLE ROW LEVEL SECURITY;

-- Test basic insert without RLS
INSERT INTO public.calendar_connections (user_id, provider, provider_id, sync_settings, is_active)
VALUES ('48635c24-cb68-4b1c-8533-7a81576c6701', 'test', 'test-url', '{}', true);

-- Check if that worked
SELECT * FROM public.calendar_connections WHERE provider = 'test';

-- Clean up the test data
DELETE FROM public.calendar_connections WHERE provider = 'test';

-- Re-enable RLS
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;