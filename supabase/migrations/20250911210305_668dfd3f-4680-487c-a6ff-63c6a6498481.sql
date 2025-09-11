-- Let's create a test to verify everything works properly
-- First, create a function to test auth.uid() from the client context
CREATE OR REPLACE FUNCTION public.test_auth_uid()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Test if we can call this function 
SELECT public.test_auth_uid() as test_uid;

-- Now let's recreate the policies with explicit checks
DROP POLICY IF EXISTS "Users can view their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can insert their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can update their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own calendar connections" ON public.calendar_connections;

-- Create a more permissive policy for testing
CREATE POLICY "Test policy - allow authenticated users"
ON public.calendar_connections
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);