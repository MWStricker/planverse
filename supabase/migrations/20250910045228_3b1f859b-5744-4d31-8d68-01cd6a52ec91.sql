-- Harden access to calendar_connections tokens
-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- 2) Remove broad SELECT privileges from anon and authenticated roles
REVOKE SELECT ON TABLE public.calendar_connections FROM anon, authenticated;

-- 3) Whitelist only non-sensitive columns for authenticated users
GRANT SELECT (
  id,
  user_id,
  provider,
  provider_id,
  is_active,
  sync_settings,
  token_expires_at,
  created_at,
  updated_at
) ON TABLE public.calendar_connections TO authenticated;

-- Note: service_role retains full access for server-side use (edge functions)
-- This change prevents clients from querying access_token and refresh_token columns from the browser.
