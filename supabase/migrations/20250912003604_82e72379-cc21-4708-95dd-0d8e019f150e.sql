-- Add is_completed column to events table for tracking completion status
ALTER TABLE public.events 
ADD COLUMN is_completed boolean DEFAULT false;