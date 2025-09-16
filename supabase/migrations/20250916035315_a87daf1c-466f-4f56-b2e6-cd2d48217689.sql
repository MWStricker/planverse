-- Check and fix RLS policies for calendar_connections table
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Allow all for authenticated" ON calendar_connections;

-- Create proper RLS policies for calendar_connections
CREATE POLICY "Users can view their own calendar connections" 
ON calendar_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar connections" 
ON calendar_connections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections" 
ON calendar_connections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections" 
ON calendar_connections 
FOR DELETE 
USING (auth.uid() = user_id);