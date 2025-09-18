-- Create messages table for direct messaging
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for messages
CREATE POLICY "Users can view messages they sent or received" 
ON public.messages 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create messages they send" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update messages they sent" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = sender_id);

-- Create conversations view for easier querying
CREATE OR REPLACE VIEW public.conversations AS
SELECT DISTINCT
  CASE 
    WHEN sender_id < receiver_id THEN sender_id
    ELSE receiver_id
  END AS user1_id,
  CASE 
    WHEN sender_id < receiver_id THEN receiver_id
    ELSE sender_id
  END AS user2_id,
  GREATEST(
    (SELECT created_at FROM public.messages m2 
     WHERE (m2.sender_id = m1.sender_id AND m2.receiver_id = m1.receiver_id)
        OR (m2.sender_id = m1.receiver_id AND m2.receiver_id = m1.sender_id)
     ORDER BY created_at DESC LIMIT 1)
  ) AS last_message_at
FROM public.messages m1;

-- Create friendships table
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Create policies for friendships
CREATE POLICY "Users can view friendships they're part of" 
ON public.friendships 
FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create friendships" 
ON public.friendships 
FOR INSERT 
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Add trigger for timestamps
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_friendships_users ON public.friendships(user1_id, user2_id);