-- Check the constraint on the provider column
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.calendar_connections'::regclass
AND contype = 'c';

-- Also check the table structure to see what's defined
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'calendar_connections' 
AND table_schema = 'public'
ORDER BY ordinal_position;