-- Drop the existing check constraint if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;

-- Update existing professional accounts to default to creator type
UPDATE profiles 
SET account_type = 'professional_creator' 
WHERE account_type = 'professional';

-- Add account_type_history table for tracking account changes
CREATE TABLE IF NOT EXISTS account_type_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_account_type TEXT NOT NULL,
  new_account_type TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT
);

-- Enable RLS on account_type_history
ALTER TABLE account_type_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own history
CREATE POLICY "Users can view their account history"
ON account_type_history FOR SELECT
USING (auth.uid() = user_id);

-- System can insert history
CREATE POLICY "System can insert account history"
ON account_type_history FOR INSERT
WITH CHECK (true);