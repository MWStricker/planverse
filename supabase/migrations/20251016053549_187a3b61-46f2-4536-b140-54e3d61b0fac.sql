-- Add status_preference column to user_presence table
ALTER TABLE public.user_presence 
ADD COLUMN IF NOT EXISTS status_preference text DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.user_presence.status_preference IS 
'User''s manually selected status preference. NULL means use automatic detection. When set, automatic idle/online detection is disabled.';