-- Enable the necessary extensions for cron jobs (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if it exists
SELECT cron.unschedule('sync-canvas-feeds-every-5-minutes');

-- Create a new cron job to sync Canvas feeds every 5 minutes
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