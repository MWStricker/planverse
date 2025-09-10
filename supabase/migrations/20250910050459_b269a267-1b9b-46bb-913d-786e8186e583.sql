-- Simple but effective security: encrypt columns and restrict access
create extension if not exists pgcrypto;

-- Add encrypted columns for storing tokens (encrypted in edge functions)
alter table public.calendar_connections
  add column if not exists access_token_enc bytea,
  add column if not exists refresh_token_enc bytea;

-- Trigger to ensure plaintext tokens are never stored
create or replace function public.calendar_connections_clear_plaintext()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Always clear plaintext tokens for security
  new.access_token := null;
  new.refresh_token := null;
  return new;
end;
$$;

drop trigger if exists trg_clear_plaintext_tokens on public.calendar_connections;
create trigger trg_clear_plaintext_tokens
before insert or update on public.calendar_connections
for each row execute function public.calendar_connections_clear_plaintext();

-- Ensure RLS is properly configured
alter table public.calendar_connections enable row level security;

-- Remove broad access and grant only safe columns to authenticated users
revoke select on table public.calendar_connections from anon, authenticated;
grant select (
  id,
  user_id,
  provider,
  provider_id,
  is_active,
  sync_settings,
  token_expires_at,
  created_at,
  updated_at
) on table public.calendar_connections to authenticated;

-- Grant INSERT/UPDATE/DELETE to authenticated (they still need RLS policies to pass)
grant insert, update, delete on table public.calendar_connections to authenticated;

-- Comment explaining the security model
comment on table public.calendar_connections is 'OAuth tokens are encrypted at rest in access_token_enc and refresh_token_enc columns. Plaintext token columns are automatically cleared by trigger for security.';