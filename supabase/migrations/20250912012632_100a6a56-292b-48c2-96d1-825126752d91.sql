-- Fix search path for all remaining functions
ALTER FUNCTION public.increment_likes_count(uuid) SET search_path = public;
ALTER FUNCTION public.decrement_likes_count(uuid) SET search_path = public;
ALTER FUNCTION public.increment_comments_count(uuid) SET search_path = public;
ALTER FUNCTION public.test_auth_uid() SET search_path = public;
ALTER FUNCTION public.calendar_connections_clear_plaintext() SET search_path = public;