-- Add missing foreign key constraint for user_id to reactions table
ALTER TABLE public.reactions 
ADD CONSTRAINT reactions_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add composite index for better query performance
CREATE INDEX IF NOT EXISTS idx_reactions_message_user 
ON public.reactions(message_id, user_id);