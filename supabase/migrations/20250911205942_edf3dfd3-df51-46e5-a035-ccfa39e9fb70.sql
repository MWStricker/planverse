-- Check all constraints on the table directly from pg_constraint
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.calendar_connections'::regclass;

-- Also check if there are any triggers that might be causing this
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'calendar_connections';

-- Let's check the actual error by trying a simple insert with 'canvas'
-- But first disable RLS temporarily
ALTER TABLE public.calendar_connections DISABLE ROW LEVEL SECURITY;