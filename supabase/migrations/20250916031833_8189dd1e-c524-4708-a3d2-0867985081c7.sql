-- Add OAuth token storage to calendar_connections table
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS token_type text DEFAULT 'Bearer',
ADD COLUMN IF NOT EXISTS scope text;

-- Update existing Google Calendar connections to include scope
UPDATE calendar_connections 
SET scope = 'https://www.googleapis.com/auth/calendar'
WHERE provider = 'google' AND scope IS NULL;