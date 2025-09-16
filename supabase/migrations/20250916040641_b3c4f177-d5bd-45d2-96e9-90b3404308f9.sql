-- Fix the calendar_connections table constraint issue
-- First, check the current constraints
\d calendar_connections;

-- Add the missing unique constraint that the upsert operation needs
ALTER TABLE calendar_connections 
ADD CONSTRAINT calendar_connections_user_provider_unique 
UNIQUE (user_id, provider);