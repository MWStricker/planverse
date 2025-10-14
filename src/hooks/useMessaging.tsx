import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) {
      console.log('useMessaging: No user, skipping fetchConversations');
      return;
    }

    try {
      console.log('useMessaging: Querying conversations table...');
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      console.log('useMessaging: Conversations query result:', { data, error });

      if (error) {
        console.error('useMessaging: Error fetching conversations:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setConversations([]);
        return;
      }

      // Batch fetch all other user profiles in one query
      const otherUserIds = data.map(conv => 
        conv.user1_id === user.id ? conv.user2_id : conv.user1_id
      );

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, school, major')
        .in('user_id', otherUserIds);

      if (profileError) {
        console.error('useMessaging: Error fetching profiles:', profileError);
      }

      // Create a map for quick profile lookup
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      const conversationsWithProfiles = data.map(conv => {
        const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
        return {
          ...conv,
          other_user: profileMap.get(otherUserId)
        };
      });

      setConversations(conversationsWithProfiles);
      console.log('useMessaging: Set conversations:', conversationsWithProfiles);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessages([]);
        return;
      }

      // Batch fetch sender profiles
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      const messagesWithProfiles = data.map(message => ({
        ...message,
        sender_profile: profileMap.get(message.sender_id)
      }));

      setMessages(messagesWithProfiles);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (receiverId: string, content: string, imageUrl?: string) => {
    if (!user || (!content.trim() && !imageUrl)) return false;

    try {
      // Get or create conversation
      const { data: conversationId, error: convError } = await supabase
        .rpc('get_or_create_conversation', { other_user_id: receiverId });

      if (convError) throw convError;

      // Send message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: content.trim() || '',
          image_url: imageUrl
        });

      if (messageError) throw messageError;

      // Update conversation last message time locally
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, last_message_at: new Date().toISOString() }
          : conv
      ));

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
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