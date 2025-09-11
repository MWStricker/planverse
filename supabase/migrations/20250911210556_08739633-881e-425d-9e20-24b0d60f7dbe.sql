-- Grant explicit permissions to the authenticator role for PostgREST
GRANT ALL ON public.calendar_connections TO authenticator;
GRANT ALL ON public.calendar_connections TO anon;
GRANT ALL ON public.calendar_connections TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';