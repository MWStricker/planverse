-- First, let's check if RLS is enabled and see current policies
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'calendar_connections';

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'calendar_connections';