-- Fix RLS issues by enabling RLS on all public tables that don't have it
-- and ensure proper policies are in place

-- Enable RLS on any tables that might be missing it
DO $$
DECLARE
    table_name text;
BEGIN
    -- Get all tables in public schema that don't have RLS enabled
    FOR table_name IN
        SELECT t.tablename
        FROM pg_tables t
        LEFT JOIN pg_class c ON c.relname = t.tablename
        WHERE t.schemaname = 'public'
        AND c.relrowsecurity = false
        AND t.tablename NOT IN ('sync_stats') -- Already handled
    LOOP
        -- Enable RLS on each table
        EXECUTE 'ALTER TABLE public.' || quote_ident(table_name) || ' ENABLE ROW LEVEL SECURITY;';
        
        -- Log what we're doing
        RAISE NOTICE 'Enabled RLS on table: %', table_name;
    END LOOP;
END $$;

-- Ensure sync_stats table has proper RLS setup
ALTER TABLE public.sync_stats ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the sync_stats policy to ensure it's correct
DROP POLICY IF EXISTS "Service role can manage sync stats" ON public.sync_stats;
CREATE POLICY "Service role can manage sync stats" 
ON public.sync_stats 
FOR ALL 
USING (true);

-- Fix search path for existing functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_course_colors_updated_at() SET search_path = public;