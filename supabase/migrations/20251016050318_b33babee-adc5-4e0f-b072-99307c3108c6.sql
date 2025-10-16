-- Phase 1: Database Schema Enhancements

-- 1. Create message_status enum
CREATE TYPE message_status AS ENUM ('sending', 'sent', 'delivered', 'seen', 'failed');

-- 2. Create reactions table
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS on reactions
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reactions
CREATE POLICY "Users can add their own reactions"
  ON public.reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON public.reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view reactions on messages they can see"
  ON public.reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE id = message_id
      AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own reactions"
  ON public.reactions FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast reaction lookup
CREATE INDEX idx_reactions_message_id ON public.reactions(message_id);

-- 3. Extend messages table
ALTER TABLE public.messages
  ADD COLUMN status message_status DEFAULT 'sent',
  ADD COLUMN reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN is_ephemeral BOOLEAN DEFAULT false,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN payload JSONB DEFAULT '{}'::jsonb;

-- Index for reply lookups
CREATE INDEX idx_messages_reply_to ON public.messages(reply_to_message_id);

-- Index for ephemeral message cleanup
CREATE INDEX idx_messages_expires_at ON public.messages(expires_at) WHERE expires_at IS NOT NULL;

-- 4. Update conversations table
ALTER TABLE public.conversations
  ADD COLUMN is_muted BOOLEAN DEFAULT false,
  ADD COLUMN is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN draft_message TEXT;

-- Index for pinned conversations
CREATE INDEX idx_conversations_pinned ON public.conversations(is_pinned) WHERE is_pinned = true;

-- 5. Create realtime publication for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;