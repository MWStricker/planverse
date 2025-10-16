-- Fix user presence system with heartbeat support and automatic cleanup

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen 
  ON public.user_presence(last_seen);

CREATE INDEX IF NOT EXISTS idx_user_presence_status_last_seen 
  ON public.user_presence(status, last_seen);

-- Create function to automatically mark stale users as offline
CREATE OR REPLACE FUNCTION public.cleanup_stale_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark users as offline if they haven't been seen in 2 minutes
  UPDATE public.user_presence
  SET status = 'offline'
  WHERE status != 'offline'
    AND last_seen < NOW() - INTERVAL '2 minutes';
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_stale_presence() TO authenticated;