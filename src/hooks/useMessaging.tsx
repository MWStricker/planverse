import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEncryption } from '@/contexts/EncryptionContext';
import { encryptMessage, decryptMessage } from '@/lib/crypto/encryption';
import { encodeBase64 } from 'tweetnacl-util';
import { toast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string;
  is_read: boolean;
  created_at: string;
  is_encrypted?: boolean;
  nonce?: string;
  sender_device_id?: string;
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
  const { keyPair, isUnlocked, deviceId } = useEncryption();
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
      
      // Single optimized query with PostgreSQL joins - fetches conversations and profiles in one go
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
        // Fail gracefully - set empty conversations instead of throwing
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
        
        // Determine the other user's ID with fallback
        const otherUserId = otherUserProfile?.user_id || 
          (conv.user1_id === user.id ? conv.user2_id : conv.user1_id);
        
        // Transform profile to include 'id' field from 'user_id'
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
      // Fail gracefully instead of crashing
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string, otherUserId: string): Promise<Message[]> => {
    if (!user || !keyPair) return [];

    try {
      setLoading(true);
      
      // Fetch messages between current user and the specific conversation partner
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessages([]);
        setLoading(false);
        return [];
      }

      // Get unique sender IDs and fetch profiles with public keys
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, public_key')
        .in('user_id', senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      // Decrypt messages with legacy message handling
      const messagesWithProfiles = data.map((message) => {
        let decryptedContent = message.content;
        let messageStatus = 'plain'; // Track for debugging

        // ONLY decrypt if BOTH is_encrypted flag AND nonce are present
        if (message.is_encrypted === true && message.nonce) {
          messageStatus = 'encrypted';
          
          // CRITICAL: Only decrypt messages YOU received, not messages YOU sent
          if (message.receiver_id === user.id) {
            // You received this message - decrypt it using sender's public key
            try {
              const senderProfile = profileMap.get(message.sender_id);
              if (senderProfile?.public_key && keyPair) {
                console.log('🔓 Decrypting received message:', {
                  messageId: message.id,
                  senderId: message.sender_id,
                  receiverId: message.receiver_id,
                  senderPublicKeyPrefix: senderProfile.public_key.substring(0, 10),
                  recipientPublicKeyPrefix: encodeBase64(keyPair.publicKey).substring(0, 10),
                });

                const encryptedData = {
                  ciphertext: message.content,
                  nonce: message.nonce,
                  senderPublicKey: senderProfile.public_key
                };
                
                decryptedContent = decryptMessage(
                  encryptedData,
                  senderProfile.public_key,
                  keyPair
                );
                console.log('✅ Decryption successful for received message:', message.id);
              } else {
                messageStatus = 'decrypt_failed_keys';
                decryptedContent = "[Unable to decrypt - missing keys]";
                console.error('❌ Decryption failed - Missing keys:', { 
                  messageId: message.id,
                  hasPublicKey: !!senderProfile?.public_key, 
                  hasKeyPair: !!keyPair,
                });
              }
            } catch (error) {
              messageStatus = 'decrypt_failed_error';
              console.error('❌ Decryption error for message:', message.id, {
                error: error instanceof Error ? error.message : 'Unknown error',
                nonceLength: message.nonce?.length,
                contentLength: message.content?.length,
              });
              decryptedContent = "[Unable to decrypt message]";
            }
          } else if (message.sender_id === user.id) {
            // You SENT this message - it's encrypted for the recipient, you cannot decrypt it
            // This should not be displayed in the UI anyway (UI keeps plain text)
            messageStatus = 'sent_encrypted';
            decryptedContent = message.content; // Keep encrypted (won't be shown in UI)
            console.log('⏭️ Skipping decryption for sent message (encrypted for recipient):', message.id);
          }
        } else if (message.is_encrypted === true && !message.nonce) {
          // Legacy message: marked encrypted but missing nonce (never actually encrypted)
          messageStatus = 'legacy_plain';
          console.warn('Legacy unencrypted message detected:', message.id);
          // Content is already plain text, just display it
        }

        console.log(`Message ${message.id}: ${messageStatus}`);

        return {
          ...message,
          content: decryptedContent,
          sender_profile: profileMap.get(message.sender_id)
        };
      });

      setMessages(messagesWithProfiles);
      return messagesWithProfiles;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (receiverId: string, content: string, imageUrl?: string) => {
    if (!user || (!content.trim() && !imageUrl)) return false;

    // Check if encryption is ready - INCLUDING deviceId
    if (!isUnlocked || !keyPair || !deviceId) {
      console.error('❌ Encryption not ready:', { isUnlocked, hasKeyPair: !!keyPair, deviceId });
      toast({
        title: "Encryption Not Ready",
        description: "Please wait while we set up secure messaging... This may take a few seconds.",
        variant: "destructive"
      });
      return false;
    }

    console.log('✅ Encryption ready, sending message:', {
      isUnlocked,
      hasKeyPair: !!keyPair,
      deviceId,
      recipientId: receiverId
    });

    try {
      // Get receiver's public key, display name, and onboarding status
      const { data: receiverProfile } = await supabase
        .from('profiles')
        .select('public_key, display_name, onboarding_completed')
        .eq('user_id', receiverId)
        .single();

      if (!receiverProfile?.public_key) {
        console.error('❌ Recipient missing encryption:', receiverId);
        
        // Check if it's because they haven't completed onboarding
        const reason = !receiverProfile?.onboarding_completed
          ? "needs to complete their profile setup first"
          : "needs to log in to enable encrypted messaging";
        
        toast({
          title: "Can't Send Message",
          description: `${receiverProfile?.display_name || 'This user'} ${reason}.`,
          variant: "destructive",
          duration: 5000
        });
        return false;
      }

      // Validate recipient's public key format
      if (receiverProfile.public_key.length < 20) {
        console.error('❌ Invalid recipient public key:', {
          receiverId,
          publicKeyLength: receiverProfile.public_key.length,
        });
        toast({
          title: "Can't Send Message",
          description: "Recipient's encryption keys are not properly configured.",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Recipient encryption validated:', {
        receiverId,
        receiverPublicKeyPrefix: receiverProfile.public_key.substring(0, 10),
        senderPublicKeyPrefix: encodeBase64(keyPair.publicKey).substring(0, 10),
      });

      // Encrypt message content
      const messageText = content.trim() || '';
      console.log('🔒 Encrypting message for recipient:', receiverId);
      const encryptedData = encryptMessage(
        messageText,
        receiverProfile.public_key,
        keyPair
      );
      console.log('✅ Message encrypted successfully');

      // Get or create conversation
      const { data: conversationId, error: convError } = await supabase
        .rpc('get_or_create_conversation', { other_user_id: receiverId });

      if (convError) throw convError;

      // Insert encrypted message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: encryptedData.ciphertext,
          image_url: imageUrl,
          is_encrypted: true,
          nonce: encryptedData.nonce,
          sender_device_id: deviceId
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
      console.error('Error sending encrypted message:', error);
      toast({
        title: "Send Failed",
        description: "Could not send message. Please try again.",
        variant: "destructive"
      });
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