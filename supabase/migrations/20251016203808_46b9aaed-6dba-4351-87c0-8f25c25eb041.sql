-- Clean up orphaned messages (messages referencing non-existent profiles)
DELETE FROM public.messages
WHERE sender_id NOT IN (SELECT user_id FROM public.profiles)
   OR receiver_id NOT IN (SELECT user_id FROM public.profiles);

-- Add foreign key constraints for sender_id
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey 
  FOREIGN KEY (sender_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;

-- Add foreign key constraints for receiver_id
ALTER TABLE public.messages
  ADD CONSTRAINT messages_receiver_id_fkey 
  FOREIGN KEY (receiver_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_lookup ON public.messages(sender_id, receiver_id);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';