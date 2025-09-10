-- Secure calendar OAuth tokens without relying on Vault
create extension if not exists pgcrypto;

-- Add encrypted columns for storing tokens
alter table public.calendar_connections
  add column if not exists access_token_enc bytea,
  add column if not exists refresh_token_enc bytea;

-- Use a fixed encryption key from environment (edge functions will handle encryption)
-- This approach removes plaintext tokens from database entirely

-- Function to safely check if encrypted tokens exist (no decryption)
create or replace function public.has_calendar_tokens(connection_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select 
    access_token_enc is not null 
  from public.calendar_connections 
  where id = connection_id;
$$;

-- Trigger to clear any plaintext tokens that might be inserted
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

-- Ensure RLS is enabled and properly configured
alter table public.calendar_connections enable row level security;

-- Remove any broad access and grant only safe columns
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

-- Create safe view for frontend use
create or replace view public.calendar_connections_safe as
  select 
    id, user_id, provider, provider_id, is_active, sync_settings, 
    token_expires_at, created_at, updated_at,
    (access_token_enc is not null) as has_encrypted_tokens
  from public.calendar_connections;

grant select on public.calendar_connections_safe to authenticated;

-- Apply RLS to the view as well
alter view public.calendar_connections_safe owner to postgres;
create policy "Users can view their own connections via safe view" 
on public.calendar_connections_safe 
for select 
using (auth.uid() = user_id);