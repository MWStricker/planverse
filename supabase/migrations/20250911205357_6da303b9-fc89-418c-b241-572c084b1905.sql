-- Check if RLS is enabled on the table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'calendar_connections';

-- Enable RLS if it's not enabled
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Also check if the user has proper authentication
-- Add a test policy to allow authenticated users to at least try
CREATE POLICY "Debug policy - authenticated users can try"
ON public.calendar_connections
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Check table structure to ensure user_id field exists and is correct
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'calendar_connections' 
AND table_schema = 'public';