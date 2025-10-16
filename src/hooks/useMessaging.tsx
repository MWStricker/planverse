import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string;
  is_read: boolean;
  created_at: string;
  sender_profile?: {
    display_name: string;
    avatar_url?: string;
  };
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  other_user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
    school?: string;
    major?: string;
  };
  unread_count?: number;
}

export const useMessaging = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) {
      console.log('useMessaging: No user, skipping fetchConversations');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('useMessaging: Querying conversations table...');
      
      // Single optimized query with PostgreSQL joins
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          user1_profile:profiles!user1_id(user_id, display_name, avatar_url, school, major),
          user2_profile:profiles!user2_id(user_id, display_name, avatar_url, school, major)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      console.log('useMessaging: Conversations query result:', { data, error });

      if (error) {
        console.error('useMessaging: Error fetching conversations:', error);
        setConversations([]);
        return;
      }

      if (!data || data.length === 0) {
        setConversations([]);
        return;
      }

      // Map to determine which profile is the other user's profile
      const conversationsWithProfiles = data.map((conv: any) => {
        const otherUserProfile = conv.user1_id === user.id 
          ? conv.user2_profile 
          : conv.user1_profile;
        
        const otherUserId = otherUserProfile?.user_id || 
          (conv.user1_id === user.id ? conv.user2_id : conv.user1_id);
        
        const other_user = {
          id: otherUserId,
          display_name: otherUserProfile?.display_name || 'Unknown User',
          avatar_url: otherUserProfile?.avatar_url,
          school: otherUserProfile?.school,
          major: otherUserProfile?.major
        };

        return {
          id: conv.id,
          user1_id: conv.user1_id,
          user2_id: conv.user2_id,
          last_message_at: conv.last_message_at,
          other_user
        };
      });

      setConversations(conversationsWithProfiles);
      console.log('useMessaging: Set conversations:', conversationsWithProfiles);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string, otherUserId: string) => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch messages with sender profile
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender_profile:profiles!messages_sender_id_fkey(display_name, avatar_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .or(`sender_id.eq.${otherUserId},receiver_id.eq.${otherUserId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const processedMessages: Message[] = (messagesData || []).map(msg => ({
        ...msg,
        sender_profile: Array.isArray(msg.sender_profile) 
          ? msg.sender_profile[0] 
          : msg.sender_profile
      } as Message));

      setMessages(processedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error loading messages",
        description: "Could not fetch messages. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (receiverId: string, content: string, imageUrl?: string) => {
    if (!user) return;

    try {
      // Insert plain text message
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: content, // Plain text content
          image_url: imageUrl,
          is_read: false
        });

      if (error) throw error;

      // Get or create conversation
      const { data: conversationId, error: convError } = await supabase
        .rpc('get_or_create_conversation', { other_user_id: receiverId });

      if (convError) throw convError;
      
      // Update conversation's last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      await fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('receiver_id', user.id);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  useEffect(() => {
    console.log('useMessaging: useEffect triggered - user:', user?.id);
    if (user) {
      fetchConversations();
    }
  }, [user]);

  return {
    conversations,
    messages,
    loading,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markAsRead
  };
};
