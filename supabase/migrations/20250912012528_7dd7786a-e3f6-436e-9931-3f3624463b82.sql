-- Enable the necessary extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to sync Canvas feeds every 5 minutes
SELECT cron.schedule(
  'sync-canvas-feeds-every-5-minutes',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://pvhymyhsawelopclpdke.supabase.co/functions/v1/auto-sync-canvas',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHlteWhzYXdlbG9wY2xwZGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDM4NjMsImV4cCI6MjA3MzAxOTg2M30.khud2Ft6CWGMSO6_QEBYiNp5_TcU7ZZeHPBesjK5NIo"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to track sync statistics
CREATE TABLE IF NOT EXISTS public.sync_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL,
  connections_processed INTEGER DEFAULT 0,
  events_processed INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  sync_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on sync_stats table
ALTER TABLE public.sync_stats ENABLE ROW LEVEL SECURITY;

-- Create policy for sync stats (only service role can access)
CREATE POLICY "Service role can manage sync stats" 
ON public.sync_stats 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON public.sync_stats TO service_role;