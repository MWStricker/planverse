-- Create view for latest user settings per type
CREATE OR REPLACE VIEW public.user_settings_latest AS
SELECT DISTINCT ON (user_id, settings_type)
       id, user_id, settings_type,
       settings_data,
       created_at, updated_at
FROM public.user_settings
ORDER BY user_id, settings_type, COALESCE(updated_at, created_at) DESC, id;

-- Create RPC function for setting status (updates both user_settings and user_presence)
CREATE OR REPLACE FUNCTION public.set_my_status(
  p_online boolean, 
  p_position text, 
  p_offset int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update or insert FAB settings
  INSERT INTO public.user_settings (
    id, user_id, settings_type, settings_data, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    auth.uid(),
    'status',
    jsonb_build_object('online', p_online, 'position', p_position, 'offset', p_offset),
    now(), 
    now()
  )
  ON CONFLICT (user_id, settings_type)
  DO UPDATE SET
    settings_data = jsonb_build_object(
      'online', EXCLUDED.settings_data->>'online',
      'position', EXCLUDED.settings_data->>'position',
      'offset', (EXCLUDED.settings_data->>'offset')::int
    ),
    updated_at = now();
  
  -- Also update user_presence for consistency
  INSERT INTO public.user_presence (
    user_id, status, status_preference, last_seen, updated_at
  )
  VALUES (
    auth.uid(),
    CASE WHEN p_online THEN 'online' ELSE 'offline' END,
    CASE WHEN p_online THEN 'online' ELSE 'offline' END,
    now(),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = CASE WHEN p_online THEN 'online' ELSE 'offline' END,
    status_preference = CASE WHEN p_online THEN 'online' ELSE 'offline' END,
    last_seen = now(),
    updated_at = now();
END;
$$;