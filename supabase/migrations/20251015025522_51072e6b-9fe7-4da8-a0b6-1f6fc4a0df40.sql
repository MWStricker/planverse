-- First, delete orphaned conversations (conversations referencing non-existent profiles)
DELETE FROM public.conversations
WHERE user1_id NOT IN (SELECT user_id FROM public.profiles)
   OR user2_id NOT IN (SELECT user_id FROM public.profiles);

-- Now add foreign key constraints
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user1_id_fkey 
  FOREIGN KEY (user1_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user2_id_fkey 
  FOREIGN KEY (user2_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON public.conversations(user2_id);