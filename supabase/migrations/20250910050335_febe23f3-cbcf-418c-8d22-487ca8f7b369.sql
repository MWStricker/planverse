-- Encrypt calendar OAuth tokens at rest and restrict exposure
create extension if not exists pgcrypto;

-- New encrypted columns (idempotent)
alter table public.calendar_connections
  add column if not exists access_token_enc bytea,
  add column if not exists refresh_token_enc bytea;

-- Helper to fetch encryption key from Supabase Vault
create or replace function public.get_calendar_tokens_key()
returns text
language sql
security definer
set search_path = public
as $$
  select vault.decrypted_secret('CALENDAR_TOKENS_ENCRYPTION_KEY');
$$;

revoke all on function public.get_calendar_tokens_key() from public, authenticated;
grant execute on function public.get_calendar_tokens_key() to service_role;

-- Encrypt/decrypt helpers (used by triggers and edge functions)
create or replace function public.encrypt_token(plaintext text)
returns bytea
language sql
security definer
set search_path = public
as $$
  select pgp_sym_encrypt(plaintext, public.get_calendar_tokens_key(), 'cipher-algo=aes256, compress-algo=1');
$$;

create or replace function public.decrypt_token(cipher bytea)
returns text
language sql
security definer
set search_path = public
as $$
  select pgp_sym_decrypt(cipher, public.get_calendar_tokens_key());
$$;

revoke all on function public.encrypt_token(text) from public, authenticated;
revoke all on function public.decrypt_token(bytea) from public, authenticated;
grant execute on function public.encrypt_token(text) to service_role;
grant execute on function public.decrypt_token(bytea) to service_role;

-- Trigger to auto-encrypt incoming plaintext tokens and wipe the plaintext
create or replace function public.calendar_connections_encrypt_tokens()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.access_token is not null then
    new.access_token_enc := public.encrypt_token(new.access_token);
    new.access_token := null;
  end if;

  if new.refresh_token is not null then
    new.refresh_token_enc := public.encrypt_token(new.refresh_token);
    new.refresh_token := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_encrypt_calendar_tokens on public.calendar_connections;
create trigger trg_encrypt_calendar_tokens
before insert or update on public.calendar_connections
for each row execute function public.calendar_connections_encrypt_tokens();

-- Tighten column exposure: allow only safe columns to authenticated
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

-- Optional safe view (no tokens) for convenience
create or replace view public.calendar_connections_safe as
  select 
    id, user_id, provider, provider_id, is_active, sync_settings, 
    token_expires_at, created_at, updated_at,
    (access_token_enc is not null) as has_tokens
  from public.calendar_connections;

grant select on public.calendar_connections_safe to authenticated;
