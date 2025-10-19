-- Create unique index for client message deduplication
CREATE UNIQUE INDEX IF NOT EXISTS messages_sender_client_id_unique 
ON public.messages (sender_id, client_msg_id) 
WHERE client_msg_id IS NOT NULL;

-- Enable RLS (no-op if already on)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Replace existing policies
DROP POLICY IF EXISTS "Users can create messages they send" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages they sent" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;

-- 1) Read: only participants
CREATE POLICY "read messages (participants)"
ON public.messages
FOR SELECT
TO authenticated
USING (
  (auth.uid() = sender_id) OR (auth.uid() = receiver_id)
);

-- 2) Insert: you can only send as yourself
CREATE POLICY "send as yourself"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- 3) Update: sender can edit own message
CREATE POLICY "update own message"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- 4) Receiver can mark as read
CREATE POLICY "receiver can mark read"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Create messages_app view with automatic filtering
CREATE OR REPLACE VIEW public.messages_app AS
SELECT *
FROM public.messages m
WHERE
  -- hide expired ephemeral messages for everyone
  ((m.is_ephemeral IS DISTINCT FROM true) OR (m.expires_at IS NULL) OR (NOW() < m.expires_at))
  -- hide soft-deleted messages from the other participant
  AND (
    m.deleted_at IS NULL
    OR auth.uid() = m.sender_id
  );

-- Grant permissions on the view
GRANT SELECT ON public.messages_app TO authenticated;

-- Function to mark all messages in a thread as read (bulk operation)
CREATE OR REPLACE FUNCTION public.mark_thread_read(p_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.messages
  SET is_read = true, updated_at = NOW()
  WHERE receiver_id = auth.uid() 
    AND sender_id = p_user 
    AND is_read IS DISTINCT FROM true;
$$;

GRANT EXECUTE ON FUNCTION public.mark_thread_read(uuid) TO authenticated;

-- Function to send a message with client id de-dupe (idempotent)
CREATE OR REPLACE FUNCTION public.send_message(
  p_receiver uuid,
  p_content text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_client_id text DEFAULT NULL,
  p_reply_to uuid DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  out_row public.messages;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.messages (
    sender_id, 
    receiver_id, 
    content, 
    image_url, 
    client_msg_id, 
    status,
    reply_to_message_id
  )
  VALUES (
    me, 
    p_receiver, 
    COALESCE(p_content, ''), 
    p_image_url, 
    p_client_id, 
    'sent',
    p_reply_to
  )
  ON CONFLICT (sender_id, client_msg_id) 
  WHERE client_msg_id IS NOT NULL
  DO UPDATE SET updated_at = NOW()
  RETURNING * INTO out_row;

  RETURN out_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text, text, uuid) TO authenticated;