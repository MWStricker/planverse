import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { fetchConversations as fetchConversationsData } from '@/data/messaging';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string;
  is_read: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';
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
  is_pinned?: boolean;
  is_muted?: boolean;
  display_order?: number | null;
  unread_count?: number;
  last_message?: {
    id: string;
    content: string | null;
    image_url: string | null;
    sender_id: string;
    created_at: string;
  };
  other_user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
    school?: string;
    major?: string;
  };
}

export const useMessaging = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      console.log('useMessaging: No user, skipping fetchConversations');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get blocked users
      const { data: blockedData } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);
      const blockedUserIds = new Set(blockedData?.map(row => row.blocked_id) || []);

      // Get hidden conversations
      const { data: hiddenData } = await supabase
        .from('hidden_conversations')
        .select('conversation_id')
        .eq('user_id', user.id);
      const hiddenConversationIds = new Set(hiddenData?.map(h => h.conversation_id) || []);

      // Call data layer with built-in fallback
      const { rows, profiles } = await fetchConversationsData();
      
      console.log('useMessaging: Got', rows.length, 'conversations from data layer');

      // Filter blocked users and transform to Conversation interface
      const filteredRows = rows.filter(conv => !blockedUserIds.has(conv.peer_id));

      // Get pin/mute status from conversations table
      const peerIds = filteredRows.map(conv => conv.peer_id);
      const { data: convSettings } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id, user1_is_pinned, user2_is_pinned, user1_is_muted, user2_is_muted')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const settingsMap = new Map(
        convSettings?.map(c => {
          const peerId = c.user1_id === user.id ? c.user2_id : c.user1_id;
          const isUser1 = c.user1_id === user.id;
          return [
            peerId,
            {
              id: c.id,
              is_pinned: isUser1 ? c.user1_is_pinned : c.user2_is_pinned,
              is_muted: isUser1 ? c.user1_is_muted : c.user2_is_muted,
            }
          ];
        }) || []
      );

      // Transform to Conversation interface
      const conversationsWithProfiles = filteredRows
        .map(conv => {
          const profile = profiles[conv.peer_id];
          const settings = settingsMap.get(conv.peer_id);
          
          // Generate preview text
          const lastText = conv.last_content?.trim() 
            ? conv.last_content 
            : (conv.last_image_url ? '[photo]' : '');
          
          return {
            id: settings?.id || `temp-${conv.peer_id}`,
            user1_id: user.id < conv.peer_id ? user.id : conv.peer_id,
            user2_id: user.id < conv.peer_id ? conv.peer_id : user.id,
            last_message_at: conv.last_created_at,
            is_pinned: settings?.is_pinned || false,
            is_muted: settings?.is_muted || false,
            display_order: null,
            unread_count: conv.unread_count,
            last_message: {
              id: `msg-${conv.last_seq}`,
              content: lastText,
              image_url: conv.last_image_url,
              sender_id: conv.last_sender,
              created_at: conv.last_created_at,
            },
            other_user: {
              id: conv.peer_id,
              display_name: profile?.display_name || 'Unknown User',
              avatar_url: profile?.avatar_url,
              school: profile?.school,
              major: profile?.major,
            }
          };
        })
        .filter(conv => !hiddenConversationIds.has(conv.id));

      setConversations(conversationsWithProfiles);
      console.log('useMessaging: Set', conversationsWithProfiles.length, 'conversations');
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMessages = useCallback(async (conversationId: string, otherUserId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Use messages_app view which filters expired/soft-deleted messages
      const { data, error } = await supabase
        .from('messages_app')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('seq_num', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      // Get unique sender IDs and fetch profiles in batch
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

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
  }, [user]);

  const sendMessage = async (
    receiverId: string, 
    content: string, 
    imageUrl?: string,
    replyToMessageId?: string
  ) => {
    if (!user || (!content.trim() && !imageUrl)) return false;

    // Generate client-side UUID for idempotency
    const clientMsgId = crypto.randomUUID();

    try {
      // Get or create conversation
      const { data: conversationId, error: convError } = await supabase
        .rpc('get_or_create_conversation', { other_user_id: receiverId });

      if (convError) throw convError;

      // Use send_message RPC for idempotent sending with deduplication
      const { data: sentMessage, error: messageError } = await supabase
        .rpc('send_message', {
          p_receiver: receiverId,
          p_content: content.trim() || '',
          p_image_url: imageUrl,
          p_client_id: clientMsgId,
          p_reply_to: replyToMessageId
        });

      if (messageError) throw messageError;

      // Send notification to the receiver
      try {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();

        const senderName = senderProfile?.display_name || 'Someone';
        const messagePreview = content.trim() 
          ? content.substring(0, 50) + (content.length > 50 ? '...' : '')
          : 'Sent an image';

        await supabase.functions.invoke('send-notification', {
          body: {
            userId: receiverId,
            type: 'new_message',
            title: `New message from ${senderName}`,
            message: messagePreview,
            data: {
              senderId: user.id,
              conversationId: conversationId,
              hasImage: !!imageUrl
            }
          }
        });
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
      }

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

  const markThreadRead = async (otherUserId: string) => {
    if (!user) return;

    try {
      await supabase.rpc('mark_thread_read', { p_user: otherUserId });
    } catch (error) {
      console.error('Error marking thread as read:', error);
    }
  };

  const softDeleteMessage = async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user.id);
    } catch (error) {
      console.error('Error soft deleting message:', error);
    }
  };

  useEffect(() => {
    console.log('useMessaging: useEffect triggered - user:', user?.id);
    if (user) {
      fetchConversations();
    }
  }, [user]);

  // Real-time conversation updates
  useEffect(() => {
    if (!user) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleConversationsChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('useMessaging: Conversations changed event received', customEvent.detail);
      
      // Debounce refetch to prevent excessive queries
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('useMessaging: Refetching conversations due to real-time update');
        fetchConversations();
      }, 300);
    };

    const handleHiddenConversationsChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('useMessaging: Hidden conversations changed', customEvent.detail);
      
      // Immediate refetch for hide/unhide actions
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('useMessaging: Refetching after hide/unhide');
        fetchConversations();
      }, 100);
    };

    // Add event listeners
    window.addEventListener('conversations-changed', handleConversationsChanged);
    window.addEventListener('hidden-conversations-changed', handleHiddenConversationsChanged);

    // Cleanup
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('conversations-changed', handleConversationsChanged);
      window.removeEventListener('hidden-conversations-changed', handleHiddenConversationsChanged);
    };
  }, [user, fetchConversations]);

  return {
    conversations,
    messages,
    loading,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markAsRead,
    markThreadRead,
    softDeleteMessage
  };
};