-- Create message_pins table for pinning messages in conversations
CREATE TABLE public.message_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id)
);

-- Index for fast lookups by conversation
CREATE INDEX idx_message_pins_conversation ON public.message_pins(conversation_id);

-- Enable Row Level Security
ALTER TABLE public.message_pins ENABLE ROW LEVEL SECURITY;

-- Users can view pins in conversations they're part of
CREATE POLICY "Users can view pins in their conversations"
  ON public.message_pins
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

-- Users can pin messages in their conversations
CREATE POLICY "Users can pin messages"
  ON public.message_pins
  FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

-- Users can unpin their own pins
CREATE POLICY "Users can unpin messages"
  ON public.message_pins
  FOR DELETE
  USING (pinned_by = auth.uid());