-- Performance optimization indexes for faster queries

-- Speed up post feed queries (promoted posts first, then by creation date)
CREATE INDEX IF NOT EXISTS idx_posts_priority_created 
ON posts(promotion_priority DESC NULLS LAST, created_at DESC);

-- Speed up post user lookups
CREATE INDEX IF NOT EXISTS idx_posts_user_id 
ON posts(user_id) WHERE moderation_status IN ('approved', 'pending', 'flagged');

-- Speed up post likes lookups
CREATE INDEX IF NOT EXISTS idx_post_likes_user_post 
ON post_likes(user_id, post_id);

-- Speed up blocked users checks
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker 
ON blocked_users(blocker_id, blocked_id);

-- Speed up messaging queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON messages(sender_id, receiver_id, seq_num DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_users 
ON conversations(user1_id, user2_id);

-- Speed up notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, read, created_at DESC);

-- Speed up friend lookups
CREATE INDEX IF NOT EXISTS idx_friendships_user1 
ON friendships(user1_id);

CREATE INDEX IF NOT EXISTS idx_friendships_user2 
ON friendships(user2_id);

-- Speed up presence queries
CREATE INDEX IF NOT EXISTS idx_user_presence_status 
ON user_presence(status, last_seen DESC) WHERE status = 'online';
