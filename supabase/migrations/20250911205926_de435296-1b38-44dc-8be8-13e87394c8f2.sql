-- Let's look for check constraints on provider field more specifically
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_type,
    cc.check_clause
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    LEFT JOIN information_schema.check_constraints cc
      ON cc.constraint_name = tc.constraint_name
WHERE tc.table_name='calendar_connections' 
AND tc.table_schema='public';

-- Let's also try to see what values are currently allowed for provider
SELECT DISTINCT provider FROM public.calendar_connections;

-- Try adding canvas to whatever constraint exists
-- First, let's see if it's an enum or check constraint
SELECT 
    t.typname,
    e.enumlabel
FROM pg_type t 
   JOIN pg_enum e ON t.oid = e.enumtypid  
   JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
AND t.typname LIKE '%provider%';