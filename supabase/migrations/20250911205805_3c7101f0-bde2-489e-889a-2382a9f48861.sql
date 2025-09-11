-- Check the table constraints
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'public.calendar_connections'::regclass;

-- Check the structure of the provider column
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'calendar_connections' 
AND column_name = 'provider';

-- Check if there's an enum or check constraint on provider
SELECT t.typname, e.enumlabel
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%provider%' OR t.typname LIKE '%calendar%';

-- Let's see the actual table definition
SELECT column_name, data_type, udt_name
FROM information_schema.columns 
WHERE table_name = 'calendar_connections' 
AND table_schema = 'public'
ORDER BY ordinal_position;