-- Update user_presence table to support the new status values
ALTER TABLE public.user_presence 
DROP CONSTRAINT IF EXISTS user_presence_status_check;

-- Add constraint to ensure only valid status values
ALTER TABLE public.user_presence 
ADD CONSTRAINT user_presence_status_check 
CHECK (status IN ('online', 'idle', 'dnd', 'offline'));

-- Enable realtime for user_presence table
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

-- Add user_presence to realtime publication if not already added
DO $$
BEGIN
  -- Check if publication exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  -- Add table to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END $$;