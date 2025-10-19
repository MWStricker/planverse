-- Add get_conversations RPC function for efficient conversation list queries
-- This function aggregates last message data, unread counts, and peer information in a single optimized query

CREATE OR REPLACE FUNCTION public.get_conversations(me uuid)
RETURNS TABLE (
  peer_id uuid,
  last_message_id uuid,
  last_text text,
  image_url text,
  last_at timestamptz,
  last_sender_id uuid,
  unread_count int
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public 
AS $$
  WITH conv AS (
    SELECT
      CASE WHEN sender_id = me THEN receiver_id ELSE sender_id END AS peer_id,
      id, content, image_url, created_at, sender_id, receiver_id, is_read, seq_num
    FROM public.messages
    WHERE sender_id = me OR receiver_id = me
  ),
  last AS (
    -- Grab latest per peer (uses seq_num for guaranteed ordering)
    SELECT DISTINCT ON (peer_id)
      peer_id, id, content, image_url, created_at, sender_id
    FROM conv
    ORDER BY peer_id, seq_num DESC
  ),
  unread AS (
    SELECT
      CASE WHEN sender_id = me THEN receiver_id ELSE sender_id END AS peer_id,
      COUNT(*)::int AS unread_count
    FROM public.messages
    WHERE receiver_id = me AND is_read = false
    GROUP BY 1
  )
  SELECT
    l.peer_id,
    l.id AS last_message_id,
    -- If the last message has no text but has an image, show a token label
    COALESCE(NULLIF(l.content, ''), CASE WHEN l.image_url IS NOT NULL AND l.image_url <> '' THEN '[photo]' ELSE '' END) AS last_text,
    l.image_url,
    l.created_at AS last_at,
    l.sender_id AS last_sender_id,
    COALESCE(u.unread_count, 0) AS unread_count
  FROM last l
  LEFT JOIN unread u USING (peer_id)
  -- Safety: only allow the logged-in user to query their own list
  WHERE me = auth.uid()
  ORDER BY l.created_at DESC;
$$;