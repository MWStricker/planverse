-- Add hidden_conversations table to track which users have dismissed which conversations
CREATE TABLE IF NOT EXISTS public.hidden_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  hidden_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

-- Enable RLS
ALTER TABLE public.hidden_conversations ENABLE ROW LEVEL SECURITY;

-- Users can hide their own conversations
CREATE POLICY "Users can hide their own conversations"
ON public.hidden_conversations
FOR INSERT
TO authenticated
WITH CHECK (auth_uid() = user_id);

-- Users can view their hidden conversations
CREATE POLICY "Users can view their hidden conversations"
ON public.hidden_conversations
FOR SELECT
TO authenticated
USING (auth_uid() = user_id);

-- Users can unhide conversations
CREATE POLICY "Users can unhide conversations"
ON public.hidden_conversations
FOR DELETE
TO authenticated
USING (auth_uid() = user_id);