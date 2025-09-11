-- Try inserting with 'canvas' provider to see exact error
INSERT INTO public.calendar_connections (user_id, provider, provider_id, sync_settings, is_active)
VALUES ('48635c24-cb68-4b1c-8533-7a81576c6701', 'canvas', 'test-url', '{}', true);

-- If that works, clean it up
DELETE FROM public.calendar_connections WHERE provider_id = 'test-url';

-- Re-enable RLS 
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;