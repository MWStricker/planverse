-- 1. Add responded_at column to track when requests were acted upon
ALTER TABLE friend_requests 
ADD COLUMN IF NOT EXISTS responded_at timestamp with time zone;

-- 2. Update status check constraint to include 'canceled'
ALTER TABLE friend_requests 
DROP CONSTRAINT IF EXISTS friend_requests_status_check;

ALTER TABLE friend_requests 
ADD CONSTRAINT friend_requests_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'canceled'::text]));

-- 3. Enable btree_gist extension for direction-agnostic unique index
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 4. Create direction-agnostic unique index to prevent both A→B and B→A pending simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_pair
ON friend_requests (
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id)
)
WHERE status = 'pending';

-- 5. Create trigger function to auto-close pending requests when friendship is created
CREATE OR REPLACE FUNCTION close_pendings_on_friendship()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE friend_requests
  SET status = 'accepted', responded_at = now()
  WHERE status = 'pending'
    AND (
      (sender_id = NEW.user1_id AND receiver_id = NEW.user2_id) OR
      (sender_id = NEW.user2_id AND receiver_id = NEW.user1_id)
    );
  RETURN NEW;
END $$;

-- 6. Create trigger to auto-close pending requests
DROP TRIGGER IF EXISTS trg_close_pendings_on_friendship ON friendships;
CREATE TRIGGER trg_close_pendings_on_friendship
AFTER INSERT ON friendships
FOR EACH ROW EXECUTE FUNCTION close_pendings_on_friendship();

-- 7. Create RPC function to cancel friend requests
CREATE OR REPLACE FUNCTION rpc_cancel_friend_request(target_user_id uuid)
RETURNS void 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE friend_requests
  SET status = 'canceled', responded_at = now()
  WHERE sender_id = auth.uid()
    AND receiver_id = target_user_id
    AND status = 'pending';
$$;

-- 8. Create RPC function to get pending request counts efficiently
CREATE OR REPLACE FUNCTION rpc_get_friend_request_counts()
RETURNS TABLE(incoming bigint, outgoing bigint, total bigint) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) FILTER (WHERE receiver_id = auth.uid()) as incoming,
    COUNT(*) FILTER (WHERE sender_id = auth.uid()) as outgoing,
    COUNT(*) as total
  FROM friend_requests
  WHERE status = 'pending'
    AND (sender_id = auth.uid() OR receiver_id = auth.uid());
$$;

-- 9. Add RLS policy to allow users to update their own pending requests
DROP POLICY IF EXISTS pr_update_own_pending ON friend_requests;
CREATE POLICY pr_update_own_pending
ON friend_requests FOR UPDATE
TO authenticated
USING (sender_id = auth.uid() AND status = 'pending')
WITH CHECK (sender_id = auth.uid());