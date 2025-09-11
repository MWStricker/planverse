-- Drop ALL existing policies 
DROP POLICY IF EXISTS "Test policy - allow authenticated users" ON public.calendar_connections;

-- Create a very simple test policy that allows everything for authenticated users
CREATE POLICY "Allow all for authenticated"
ON public.calendar_connections
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);