-- Check all constraints on the table more directly
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'calendar_connections'::regclass;

-- Let's try to see the actual table definition
SELECT 
    pg_get_tabledef('public.calendar_connections'::regclass) as table_definition;