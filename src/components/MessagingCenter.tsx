import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, ArrowLeft, School, Upload, X, Smile, Settings } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableConversationItem } from './messaging/SortableConversationItem';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { useMessaging, Conversation, Message } from '@/hooks/useMessaging';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ImageViewer } from '@/components/ImageViewer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PublicProfile } from './PublicProfile';
import type { PublicProfile as PublicProfileType } from '@/hooks/useConnect';
import { ReactionBar } from './messaging/ReactionBar';
import { ReactionPill } from './messaging/ReactionPill';
import { ReactionSheet } from './messaging/ReactionSheet';
import { MessageActionSheet } from './messaging/MessageActionSheet';
import { ReplyPreview } from './messaging/ReplyPreview';
import { useReactions } from '@/hooks/useReactions';
import { MessageBubble } from './messaging/MessageBubble';
import { NewMessagesPill } from './messaging/NewMessagesPill';
import { useMessagingSettings } from '@/hooks/useMessagingSettings';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessagePinsBanner } from './messaging/MessagePinsBanner';

interface MessagingCenterProps {
  selectedUserId?: string;
  onClose?: () => void;
}

export const MessagingCenter: React.FC<MessagingCenterProps> = ({ 
  selectedUserId, 
  onClose 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { conversations: hookConversations, messages, loading, fetchConversations, fetchMessages, sendMessage } = useMessaging();
  const [conversations, setConversations] = useState<Conversation[]>(hookConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<PublicProfileType | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [reactionSheetMessage, setReactionSheetMessage] = useState<Message | null>(null);
  const [actionSheetMessage, setActionSheetMessage] = useState<Message | null>(null);
  const [reactionBarMessageId, setReactionBarMessageId] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { settings: messagingSettings, updateSetting } = useMessagingSettings();
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSavingOrder = useRef(false);

  console.log('MessagingCenter: Render - loading:', loading, 'conversations:', conversations.length);

  // Sync local conversations with hook updates (but not during drag-and-drop saves)
  useEffect(() => {
    if (isSavingOrder.current) {
      console.log('Skipping conversation sync - save in progress');
      return;
    }
    setConversations(hookConversations);
  }, [hookConversations]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Debug logging for action sheet state
  useEffect(() => {
    console.log('[MessagingCenter] actionSheetMessage changed:', actionSheetMessage?.id || 'null');
  }, [actionSheetMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  };

  // Detect if user is near bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsNearBottom(distanceFromBottom < 100);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [selectedConversation]);

  // Sync messages to local state and track new messages
  useEffect(() => {
    if (isNearBottom) {
      setNewMessagesCount(0);
    } else {
      // Increment count when new message arrives and user is scrolled up
      if (messages.length > localMessages.length) {
        const diff = messages.length - localMessages.length;
        setNewMessagesCount(prev => prev + diff);
      }
    }
    setLocalMessages(messages);
  }, [messages, isNearBottom]);

  useEffect(() => {
    console.log('MessagingCenter: useEffect triggered - user:', user?.id, 'conversations:', conversations.length);
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [localMessages, isNearBottom]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedConversation || !user) return;

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        console.log('Realtime message received:', payload);
        const newMessage = payload.new as Message;
        // Only add if it's part of this conversation
        if ((newMessage.sender_id === user.id && newMessage.receiver_id === selectedConversation.other_user?.id) ||
            (newMessage.receiver_id === user.id && newMessage.sender_id === selectedConversation.other_user?.id)) {
          setLocalMessages(prev => {
            // Check if this is replacing a temp message
            const tempIndex = prev.findIndex(m => 
              m.id.startsWith('temp-') &&
              m.sender_id === newMessage.sender_id &&
              m.content === newMessage.content &&
              Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000
            );
            
            if (tempIndex !== -1) {
              console.log('Replacing temp message with real message:', prev[tempIndex].id, '->', newMessage.id);
              // Replace temp with real message
              const updated = [...prev];
              updated[tempIndex] = newMessage;
              return updated;
            }
            
            // Check for duplicate (already exists)
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            
            // If this is a message TO us, mark it as delivered
            if (newMessage.receiver_id === user.id && newMessage.status === 'sent') {
              supabase
                .from('messages')
                .update({ status: 'delivered' })
                .eq('id', newMessage.id)
                .then(() => console.log(`Message ${newMessage.id} marked as delivered`));
            }
            
            // New message from other user
            return [...prev, newMessage];
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        console.log('Realtime message updated:', payload);
        const updatedMessage = payload.new as Message;
        
        // Update status in local messages (for sender to see status changes)
        setLocalMessages(prev => 
          prev.map(m => 
            m.id === updatedMessage.id 
              ? { ...m, status: updatedMessage.status, is_read: updatedMessage.is_read }
              : m
          )
        );
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, user]);

  // Reset unread count when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !user) return;

    // Optimistic UI update - clear badge immediately
    setConversations(prev => 
      prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { ...conv, unread_count: 0 }
          : conv
      )
    );

    // Update database in background
    const resetUnreadCount = async () => {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', selectedConversation.id)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      
      if (error) {
        console.error('Error resetting unread count:', error);
      }
    };

    resetUnreadCount();
  }, [selectedConversation, user]);

  // Typing indicators with 2s TTL
  useEffect(() => {
    if (!selectedConversation || !user) return;
    let typingTimeoutId: NodeJS.Timeout | null = null;

    console.log('[Typing] Initializing channel for conversation:', selectedConversation.id);

    const typingChannel = supabase
      .channel(`typing:${selectedConversation.id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        console.log('[Typing] Received typing event:', payload);
        if (payload.payload.userId !== user.id) {
          setIsTyping(true);
          
          if (typingTimeoutId) clearTimeout(typingTimeoutId);
          
          typingTimeoutId = setTimeout(() => {
            console.log('[Typing] Timeout expired, hiding indicator');
            setIsTyping(false);
            typingTimeoutId = null;
          }, 2000);
        }
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        console.log('[Typing] Received typing_stop event:', payload);
        if (payload.payload.userId !== user.id) {
          if (typingTimeoutId) clearTimeout(typingTimeoutId);
          setIsTyping(false);
        }
      })
      .subscribe((status) => {
        console.log('[Typing] Channel subscription status:', status);
        
        // Only set ref when fully subscribed
        if (status === 'SUBSCRIBED') {
          typingChannelRef.current = typingChannel;
          console.log('[Typing] Channel reference stored');
        }
      });

    return () => {
      console.log('[Typing] Cleaning up channel');
      if (typingTimeoutId) clearTimeout(typingTimeoutId);
      typingChannelRef.current = null;
      supabase.removeChannel(typingChannel);
    };
  }, [selectedConversation, user]);

  // Mark messages as read with debouncing
  useEffect(() => {
    if (!selectedConversation || !localMessages.length || !user) return;

    const unreadMessages = localMessages.filter(
      m => m.receiver_id === user.id && !m.is_read
    );

    if (unreadMessages.length > 0) {
      const timeoutId = setTimeout(() => {
        const updates: any = { is_read: true };
        
        // Only set status to 'seen' if user has read receipts enabled
        if (messagingSettings.read_receipts_enabled) {
          updates.status = 'seen';
        }
        
        supabase
          .from('messages')
          .update(updates)
          .in('id', unreadMessages.map(m => m.id))
          .then(() => console.log('Messages marked as read'));
      }, 200);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedConversation, localMessages, user, messagingSettings]);

  // Fetch pinned messages
  useEffect(() => {
    if (!selectedConversation) {
      setPinnedMessages([]);
      return;
    }

    const fetchPinnedMessages = async () => {
      console.log('[Pins] Fetching pinned messages for conversation:', selectedConversation.id);
      
      const { data, error } = await supabase
        .from('message_pins')
        .select(`
          message_id,
          messages:message_id (
            id,
            content,
            sender_id,
            created_at,
            sender_profile:profiles!sender_id (display_name)
          )
        `)
        .eq('conversation_id', selectedConversation.id)
        .order('pinned_at', { ascending: false });

      if (error) {
        console.error('[Pins] Error fetching pinned messages:', error);
        
        // Handle specific error cases
        if (error.code === '42P01') {
          console.warn('[Pins] message_pins table not found - feature not yet available');
        } else if (error.code === 'PGRST116') {
          console.warn('[Pins] Foreign key relationship issue - schema needs migration');
        } else {
          console.error('[Pins] Unexpected error:', error.message);
        }
        
        // Don't crash the UI - just clear pins
        setPinnedMessages([]);
        return;
      }

      if (data) {
        const mappedPins = data.map((pin: any) => ({
          id: pin.messages.id,
          content: pin.messages.content,
          sender_name: pin.messages.sender_profile?.display_name || 'Unknown',
          created_at: pin.messages.created_at
        }));
        
        console.log('[Pins] Successfully fetched', mappedPins.length, 'pinned messages');
        setPinnedMessages(mappedPins);
      } else {
        console.log('[Pins] No pinned messages found');
        setPinnedMessages([]);
      }
    };

    fetchPinnedMessages();
  }, [selectedConversation]);

  // Global realtime subscription for all incoming messages
  useEffect(() => {
    if (!user) return;

    console.log('Setting up global message subscription for user:', user.id);
    
    const channel = supabase
      .channel('all-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        console.log('Global realtime: New message received:', payload);
        const newMessage = payload.new as Message;
        
        // Update conversation list
        fetchConversations();
        
        // If this message is for the currently open conversation, add it to localMessages
        if (selectedConversation && 
            newMessage.sender_id === selectedConversation.other_user?.id) {
          setLocalMessages(prev => {
            // Check for duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      })
      .subscribe();

    return () => {
      console.log('Cleaning up global message subscription');
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation, fetchConversations]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation?.other_user) {
      setLoadingMessages(true);
      fetchMessages(selectedConversation.id, selectedConversation.other_user.id)
        .finally(() => setLoadingMessages(false));
    } else {
      setLocalMessages([]);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedUserId && conversations.length > 0 && !selectedConversation) {
      const conversation = conversations.find(c => 
        c.other_user?.id === selectedUserId
      );
      if (conversation) {
        setSelectedConversation(conversation);
      }
    }
  }, [selectedUserId, conversations]);

  // Create virtual conversation for new chats
  useEffect(() => {
    if (!selectedUserId || !user) return;
    
    const existingConv = conversations.find(
      conv => conv.other_user?.id === selectedUserId
    );
    
    if (!existingConv) {
      // Fetch the other user's profile and create a virtual conversation
      supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, school, major')
        .eq('user_id', selectedUserId)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            const virtualConv: Conversation = {
              id: 'new',
              user1_id: user.id,
              user2_id: selectedUserId,
              last_message_at: new Date().toISOString(),
              other_user: {
                id: profile.user_id,
                display_name: profile.display_name || 'Unknown User',
                avatar_url: profile.avatar_url,
                school: profile.school,
                major: profile.major
              }
            };
            setSelectedConversation(virtualConv);
          }
        });
    }
  }, [selectedUserId, conversations, user]);

  const handleSelectConversation = (conversation: Conversation) => {
    if (!conversation.other_user) return;
    
    // Prevent re-selecting the same conversation (avoids refresh)
    if (selectedConversation?.id === conversation.id) {
      console.log('[MessagingCenter] Clicked on active conversation, preventing refresh');
      return;
    }
    
    console.log('[MessagingCenter] Selecting new conversation:', conversation.id);
    // Instant UI update - conversation selection
    setSelectedConversation(conversation);
    setNewMessagesCount(0);
    setIsNearBottom(true);
    // Messages will be fetched by the useEffect that watches selectedConversation
  };

  const handleToggleConversationPin = async (conversationId: string, currentPinStatus: boolean) => {
    try {
      console.log('[MessagingCenter] Toggling pin for conversation:', conversationId, 'from', currentPinStatus, 'to', !currentPinStatus);
      
      const newPinnedStatus = !currentPinStatus;
      const newDisplayOrder = newPinnedStatus ? -1 : 0;
      
      // Find the conversation to determine which column to update
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return;
      
      const isUser1 = conversation.user1_id === user.id;
      const columnToUpdate = isUser1 ? 'user1_is_pinned' : 'user2_is_pinned';
      
      const { error } = await supabase
        .from('conversations')
        .update({ 
          [columnToUpdate]: newPinnedStatus,
          display_order: newDisplayOrder 
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Update local state immediately
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, is_pinned: newPinnedStatus, display_order: newDisplayOrder }
            : conv
        )
      );

      toast({
        title: newPinnedStatus ? "Conversation pinned" : "Conversation unpinned",
        description: newPinnedStatus ? "Moved to top of list" : "Moved to chronological order",
      });
    } catch (error) {
      console.error('[MessagingCenter] Error toggling pin:', error);
      toast({
        title: "Error",
        description: "Failed to update pin status",
        variant: "destructive",
      });
    }
  };

  const handleToggleConversationMute = async (conversationId: string, currentMutedStatus: boolean) => {
    try {
      // Find the conversation to determine which column to update
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return;
      
      const isUser1 = conversation.user1_id === user.id;
      const columnToUpdate = isUser1 ? 'user1_is_muted' : 'user2_is_muted';
      
      const { error } = await supabase
        .from('conversations')
        .update({ [columnToUpdate]: !currentMutedStatus })
        .eq('id', conversationId);

      if (error) throw error;

      fetchConversations();

      toast({
        title: currentMutedStatus ? "Conversation unmuted" : "Conversation muted",
        description: currentMutedStatus 
          ? "You will now receive notifications from this conversation" 
          : "You will no longer receive notifications from this conversation",
      });
    } catch (error) {
      console.error('Error toggling conversation mute:', error);
      toast({
        title: "Error",
        description: "Failed to update conversation mute status",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsUnread = async (conversationId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('id', conversationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ unread_count: (data.unread_count || 0) + 1 })
        .eq('id', conversationId);
      
      if (updateError) throw updateError;

      fetchConversations();

      toast({
        title: "Marked as unread",
        description: "This conversation will show as unread",
      });
    } catch (error) {
      console.error('Error marking conversation as unread:', error);
      toast({
        title: "Error",
        description: "Failed to mark conversation as unread",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = conversations.findIndex(c => c.id === active.id);
    const newIndex = conversations.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const movedConv = conversations[oldIndex];
    const targetConv = conversations[newIndex];

    // Don't allow dragging between pinned/unpinned sections
    if (movedConv.is_pinned !== targetConv.is_pinned) {
      toast({
        title: "Cannot move",
        description: "Cannot move between pinned and unpinned conversations",
        variant: "destructive",
      });
      return;
    }

    // Set flag to prevent sync from overwriting our changes
    isSavingOrder.current = true;

    // OPTIMISTIC UPDATE: Reorder immediately in UI
    const reorderedConversations = arrayMove(conversations, oldIndex, newIndex);
    setConversations(reorderedConversations);
    
    // Separate pinned and unpinned conversations
    const pinnedConvs = reorderedConversations.filter(c => c.is_pinned);
    const unpinnedConvs = reorderedConversations.filter(c => !c.is_pinned);
    
    // Assign display_order: negatives for pinned, positives for unpinned
    const updates = [
      ...pinnedConvs.map((conv, index) => ({
        id: conv.id,
        display_order: -(index + 1), // -1, -2, -3, ...
        user1_id: conv.user1_id,
        user2_id: conv.user2_id
      })),
      ...unpinnedConvs.map((conv, index) => ({
        id: conv.id,
        display_order: index, // 0, 1, 2, ...
        user1_id: conv.user1_id,
        user2_id: conv.user2_id
      }))
    ];

    try {
      console.log('Saving conversation order:', updates);
      
      // Batch update using upsert for atomic operation
      const { error } = await supabase
        .from('conversations')
        .upsert(updates, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
      
      if (error) throw error;
      
      console.log('Conversation order saved successfully');
      
      // Refetch in background, only clear flag after it completes
      fetchConversations().finally(() => {
        // Now it's safe to allow syncing again
        isSavingOrder.current = false;
      });
      
    } catch (error) {
      console.error('Error updating conversation order:', error);
      
      // Clear flag immediately on error so we can revert
      isSavingOrder.current = false;
      
      // Refetch to revert to last known good state
      await fetchConversations();
      
      toast({
        title: "Error",
        description: "Failed to save conversation order. Reverted to last saved state.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !imageFile) return;
    if (!selectedConversation?.other_user?.id) {
      console.error('Cannot send message: other_user.id is undefined', selectedConversation);
      toast({
        title: "Error",
        description: "Unable to identify recipient. Please try refreshing.",
        variant: "destructive",
      });
      return;
    }

    let imageUrl = '';
    
    if (imageFile) {
      setUploading(true);
      try {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `messages/${user!.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('Uploads')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('Uploads')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: "Upload Error",
          description: "Failed to upload image",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    // Optimistic update - add message immediately
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user!.id,
      receiver_id: selectedConversation.other_user.id,
      content: newMessage.trim() || '',
      image_url: imageUrl,
      is_read: false,
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    setLocalMessages(prev => [...prev, tempMessage]);
    const messageContent = newMessage;
    setNewMessage('');
    setImageFile(null);

    // Send in background, don't block UI
    sendMessage(selectedConversation.other_user.id, messageContent.trim() || '', imageUrl, replyToMessage?.id)
      .then(async (success) => {
        setReplyToMessage(null);
        if (!success) {
          // Only remove on failure
          setLocalMessages(prev => prev.filter(m => m.id !== tempMessage.id));
          toast({
            title: "Error",
            description: "Failed to send message",
            variant: "destructive",
          });
          return;
        }
        
        // SUCCESS: Fetch the latest message as fallback in case realtime doesn't fire
        setTimeout(async () => {
          const { data: latestMessages } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedConversation.other_user.id}),and(sender_id.eq.${selectedConversation.other_user.id},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (latestMessages && latestMessages.length > 0) {
            const realMessage = latestMessages[0];
            setLocalMessages(prev => {
              // Replace temp message with real one if it still exists
              const tempIndex = prev.findIndex(m => m.id === tempMessage.id);
              if (tempIndex !== -1) {
                console.log('Fallback: Replacing temp message with fetched message');
                const updated = [...prev];
                updated[tempIndex] = realMessage;
                return updated;
              }
              return prev;
            });
          }
        }, 500); // Wait 500ms for database to process
      });

    // Set timeout to remove temp message if not replaced within 10 seconds
    setTimeout(() => {
      setLocalMessages(prev => {
        const stillTemp = prev.find(m => m.id === tempMessage.id);
        if (stillTemp) {
          console.warn('Temp message not replaced after 10s, removing:', tempMessage.id);
          return prev.filter(m => m.id !== tempMessage.id);
        }
        return prev;
      });
    }, 10000);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleProfileClick = async (userId: string) => {
    console.log('handleProfileClick called with userId:', userId);
    
    // Prevent multiple rapid clicks
    if (profileLoading) {
      console.log('Already loading, ignoring click');
      return;
    }
    
    // Open dialog FIRST, then load data
    setSelectedPublicProfile(null);
    setProfileDialogOpen(true);
    setProfileLoading(true);
    console.log('Dialog opened and loading started for userId:', userId);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      console.log('Profile fetch result:', { data, error });

      if (error) throw error;

      if (data) {
        const profileData = {
          id: data.user_id,
          user_id: data.user_id, // Add this for Spotify component
          display_name: data.display_name || 'Unknown User',
          avatar_url: data.avatar_url,
          school: data.school,
          major: data.major,
          graduation_year: data.graduation_year,
          bio: data.bio,
          is_public: data.is_public,
          social_links: (data.social_links as Record<string, string>) || {},
        };
        
        console.log('Setting profile data:', profileData);
        setSelectedPublicProfile(profileData);
        console.log('Profile data set, dialog should be open:', profileData.display_name);
      } else {
        console.warn('No profile data returned');
        toast({
          title: "Profile Not Found",
          description: "Could not load user profile",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCloseProfileDialog = (open: boolean) => {
    setProfileDialogOpen(open);
    if (!open) {
      // Clear profile data when dialog closes
      setSelectedPublicProfile(null);
      console.log('Profile dialog closed and data cleared');
    }
  };

  const handleMessageLongPress = (message: Message) => {
    console.log('[MessagingCenter] Opening action sheet for message:', message.id);
    setActionSheetMessage(message);
  };

  const handleCopyMessage = () => {
    if (!actionSheetMessage) return;
    navigator.clipboard.writeText(actionSheetMessage.content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard"
    });
  };

  const handleDeleteMessage = async () => {
    if (!actionSheetMessage) return;
    setLocalMessages(prev => prev.filter(m => m.id !== actionSheetMessage.id));
    toast({
      title: "Deleted",
      description: "Message deleted for you"
    });
  };

  const handleUnsendMessage = async () => {
    if (!actionSheetMessage) return;
    try {
      await supabase.from('messages').delete().eq('id', actionSheetMessage.id);
      setLocalMessages(prev => prev.filter(m => m.id !== actionSheetMessage.id));
      toast({
        title: "Unsent",
        description: "Message removed for everyone"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unsend message",
        variant: "destructive"
      });
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!selectedConversation || !user) return;

    try {
      const { error } = await supabase
        .from('message_pins')
        .insert({
          message_id: messageId,
          conversation_id: selectedConversation.id,
          pinned_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Message pinned",
        description: "Message has been pinned to the top of the chat.",
      });
    } catch (error) {
      console.error('Error pinning message:', error);
      toast({
        title: "Error",
        description: "Failed to pin message.",
        variant: "destructive"
      });
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('message_pins')
        .delete()
        .eq('message_id', messageId);

      if (error) throw error;

      toast({
        title: "Message unpinned",
        description: "Message has been unpinned.",
      });
    } catch (error) {
      console.error('Error unpinning message:', error);
    }
  };

  const handleJumpToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-primary/10');
      setTimeout(() => element.classList.remove('bg-primary/10'), 2000);
    }
  };

  const handleTyping = () => {
    if (!selectedConversation || !user) {
      console.log('[Typing] Skipping: no conversation or user');
      return;
    }
    
    if (!typingChannelRef.current) {
      console.log('[Typing] Skipping: channel not ready yet');
      return;
    }
    
    // Check if typing indicators are enabled
    if (!messagingSettings.typing_indicators_enabled) {
      console.log('[Typing] Skipping: typing indicators disabled');
      return;
    }
    
    console.log('[Typing] Sending typing event');
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // Use the EXISTING channel from the ref
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, conversationId: selectedConversation.id }
    });
    
    // Send explicit stop after 2 seconds of no typing
    const timeout = setTimeout(() => {
      if (typingChannelRef.current) {
        console.log('[Typing] Sending typing_stop event');
        typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing_stop',
          payload: { userId: user.id }
        });
      }
    }, 2000);
    setTypingTimeout(timeout);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[600px] flex bg-background border rounded-lg overflow-hidden">
      {/* Conversations List */}
      <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r`}>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-foreground">Messages</h3>
        </div>
        
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={[...conversations]
                  .sort((a, b) => {
                    // Pinned conversations ALWAYS go first
                    if (a.is_pinned && !b.is_pinned) return -1;
                    if (!a.is_pinned && b.is_pinned) return 1;
                    
                    // Among pinned (or among unpinned), sort by display_order
                    if (a.display_order !== null && b.display_order !== null) {
                      return a.display_order - b.display_order;
                    }
                    if (a.display_order !== null) return -1;
                    if (b.display_order !== null) return 1;
                    
                    // Fallback to chronological
                    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
                  }).map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {[...conversations]
                  .sort((a, b) => {
                    // Pinned conversations ALWAYS go first
                    if (a.is_pinned && !b.is_pinned) return -1;
                    if (!a.is_pinned && b.is_pinned) return 1;
                    
                    // Among pinned (or among unpinned), sort by display_order
                    if (a.display_order !== null && b.display_order !== null) {
                      return a.display_order - b.display_order;
                    }
                    if (a.display_order !== null) return -1;
                    if (b.display_order !== null) return 1;
                    
                    // Fallback to chronological
                    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
                  })
                  .map((conversation) => (
                    <SortableConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selectedConversation?.id === conversation.id}
                      onSelect={handleSelectConversation}
                      onPin={handleToggleConversationPin}
                      onMute={handleToggleConversationMute}
                      onMarkUnread={handleMarkAsUnread}
                    />
                  ))}
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <button
                  onClick={() => {
                    if (selectedConversation.other_user?.id) {
                      handleProfileClick(selectedConversation.other_user.id);
                    }
                  }}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.other_user?.avatar_url} />
                    <AvatarFallback>
                      {selectedConversation.other_user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <h4 className="font-semibold text-foreground">
                      {selectedConversation.other_user?.display_name || 'Unknown User'}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {selectedConversation.other_user?.school && (
                        <span>{selectedConversation.other_user.school}</span>
                      )}
                      {selectedConversation.other_user?.major && (
                        <>
                          <span>•</span>
                          <span>{selectedConversation.other_user.major}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
                {/* Chat Settings Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowChatSettings(true)}
                  className="ml-auto"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollContainerRef} className="flex-1 p-4 relative">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading messages...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Pinned Messages Banner */}
                  {pinnedMessages.length > 0 && (
                    <MessagePinsBanner
                      pinnedMessages={pinnedMessages}
                      onJumpToMessage={handleJumpToMessage}
                      onUnpin={handleUnpinMessage}
                      currentUserId={user?.id || ''}
                      conversationCreatorId={selectedConversation?.user1_id || ''}
                    />
                  )}
                  
                  <div className="space-y-4">
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    {localMessages.map((message) => {
                      const isOwn = message.sender_id === user?.id;
                      const isTemp = message.id.startsWith('temp-');
                      return (
                        <div key={message.id} id={`message-${message.id}`}>
                          <MessageBubble
                            message={message}
                            isOwn={isOwn}
                            isTemp={isTemp}
                            onImageClick={(url) => setViewerImage(url)}
                            onLongPress={handleMessageLongPress}
                            onReactionClick={(messageId) => {
                              const msg = localMessages.find(m => m.id === messageId);
                              if (msg) setReactionSheetMessage(msg);
                            }}
                            onPin={handlePinMessage}
                            isPinned={pinnedMessages.some(p => p.id === message.id)}
                            forceShowReactionBar={reactionBarMessageId === message.id}
                            onReactionBarClose={() => setReactionBarMessageId(null)}
                          />
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {/* New Messages Pill */}
                  <NewMessagesPill
                    count={newMessagesCount}
                    onClick={() => {
                      scrollToBottom();
                      setNewMessagesCount(0);
                    }}
                  />
                </>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              {replyToMessage && (
                <ReplyPreview
                  message={replyToMessage}
                  onDismiss={() => setReplyToMessage(null)}
                />
              )}
              {imageFile && (
                <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
                  <span className="text-sm text-foreground">Image: {imageFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <AutoTextarea
                  id="message-input"
                  name="message-input"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={uploading}
                  maxHeight={120}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={(!newMessage.trim() && !imageFile) || uploading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <input
                id="message-image-upload"
                name="message-image-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">Select a conversation</h3>
              <p className="text-muted-foreground">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Viewer */}
      <ImageViewer 
        imageUrl={viewerImage} 
        onClose={() => setViewerImage(null)} 
      />

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={handleCloseProfileDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {profileLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="ml-3 text-muted-foreground">Loading profile...</p>
            </div>
          ) : selectedPublicProfile ? (
            <PublicProfile
              profile={selectedPublicProfile}
              onSendMessage={() => {
                setProfileDialogOpen(false);
              }}
            />
          ) : (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">No profile data available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Message Action Sheet */}
      {actionSheetMessage && user && (
        <MessageActionSheet
          open={!!actionSheetMessage}
          onOpenChange={(open) => !open && setActionSheetMessage(null)}
          message={actionSheetMessage}
          currentUserId={user.id}
          onReact={() => {
            setReactionBarMessageId(actionSheetMessage.id);
            setActionSheetMessage(null);
          }}
          onReply={() => {
            setReplyToMessage(actionSheetMessage);
            setActionSheetMessage(null);
          }}
          onCopy={handleCopyMessage}
          onDelete={handleDeleteMessage}
          onUnsend={handleUnsendMessage}
          onPin={(messageId) => {
            const isPinned = pinnedMessages.some(p => p.id === messageId);
            if (isPinned) {
              handleUnpinMessage(messageId);
            } else {
              handlePinMessage(messageId);
            }
          }}
          isPinned={pinnedMessages.some(p => p.id === actionSheetMessage.id)}
          canPin={selectedConversation?.user1_id === user.id || selectedConversation?.user2_id === user.id}
        />
      )}

      {/* Reaction Sheet */}
      {reactionSheetMessage && (
        <ReactionSheet
          open={!!reactionSheetMessage}
          onOpenChange={(open) => !open && setReactionSheetMessage(null)}
          reactions={useReactions(reactionSheetMessage.id).reactions}
        />
      )}

      {/* Chat Settings Sheet */}
      <Sheet open={showChatSettings} onOpenChange={setShowChatSettings}>
        <SheetContent side="bottom" className="h-[400px]">
          <SheetHeader>
            <SheetTitle>Chat Settings</SheetTitle>
            <SheetDescription>
              Manage your messaging preferences
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-6 mt-6">
            {/* Read Receipts Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="read-receipts" className="text-base font-medium">
                  Send Read Receipts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Let people know when you've read their messages
                </p>
              </div>
              <Switch
                id="read-receipts"
                checked={messagingSettings.read_receipts_enabled}
                onCheckedChange={(checked) => 
                  updateSetting('read_receipts_enabled', checked)
                }
              />
            </div>

            {/* Typing Indicators Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="typing" className="text-base font-medium">
                  Typing Indicators
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show when you're typing a message
                </p>
              </div>
              <Switch
                id="typing"
                checked={messagingSettings.typing_indicators_enabled}
                onCheckedChange={(checked) => 
                  updateSetting('typing_indicators_enabled', checked)
                }
              />
            </div>

            <Alert>
              <AlertDescription>
                If you turn off read receipts, you won't see when others read your messages either.
              </AlertDescription>
            </Alert>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};