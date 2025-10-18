-- Enable real-time replication for conversations table
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable real-time replication for hidden_conversations table
ALTER TABLE hidden_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE hidden_conversations;