-- Add social_links column to profiles table
ALTER TABLE profiles 
ADD COLUMN social_links jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.social_links IS 'User social media platform URLs stored as {"platform": "full_url"}';