-- Drop all existing policies and recreate them with proper authentication roles
DROP POLICY IF EXISTS "Users can view their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can insert their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can update their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Debug policy - authenticated users can try" ON public.calendar_connections;

-- Ensure RLS is enabled
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Create new policies with proper roles
CREATE POLICY "Users can view their own calendar connections"
ON public.calendar_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar connections"
ON public.calendar_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
ON public.calendar_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
ON public.calendar_connections
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);