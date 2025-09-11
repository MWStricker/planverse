-- Check all constraints on the table
SELECT
    tc.constraint_name, 
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.check_constraints AS cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'calendar_connections'
AND tc.table_schema = 'public';

-- Re-enable RLS for now since it was disabled
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;