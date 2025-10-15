import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, ArrowLeft, School, Upload, X } from 'lucide-react';
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
  const { conversations, messages, loading, fetchConversations, fetchMessages, sendMessage } = useMessaging();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  console.log('MessagingCenter: Render - loading:', loading, 'conversations:', conversations.length);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Sync messages to local state
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    console.log('MessagingCenter: useEffect triggered - user:', user?.id, 'conversations:', conversations.length);
    scrollToBottom();
  }, [localMessages]);

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
              // Replace temp with real message
              const updated = [...prev];
              updated[tempIndex] = newMessage;
              return updated;
            }
            
            // Check for duplicate (already exists)
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            
            // New message from other user
            return [...prev, newMessage];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, user]);

  // Typing indicators (Phase 3)
  useEffect(() => {
    if (!selectedConversation || !user) return;

    const typingChannel = supabase
      .channel(`typing:${selectedConversation.id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 3000);
        }
      })
      .subscribe();

    return () => {
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
        supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(m => m.id))
          .then(() => console.log('Messages marked as read'));
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedConversation, localMessages, user]);

  useEffect(() => {
    if (selectedUserId && conversations.length > 0 && !selectedConversation) {
      const conversation = conversations.find(c => 
        c.other_user?.id === selectedUserId
      );
      if (conversation && conversation.other_user) {
        setSelectedConversation(conversation);
        fetchMessages(conversation.id, conversation.other_user.id);
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
    setSelectedConversation(conversation);
    fetchMessages(conversation.id, conversation.other_user.id);
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
      created_at: new Date().toISOString()
    };

    setLocalMessages(prev => [...prev, tempMessage]);
    const messageContent = newMessage;
    setNewMessage('');
    setImageFile(null);

    // Send in background, don't block UI
    sendMessage(selectedConversation.other_user.id, messageContent.trim() || '', imageUrl)
      .then((success) => {
        if (!success) {
          // Only remove on failure
          setLocalMessages(prev => prev.filter(m => m.id !== tempMessage.id));
          toast({
            title: "Error",
            description: "Failed to send message",
            variant: "destructive",
          });
        }
        // On success, realtime subscription will replace temp message
      });

    // Set timeout to remove temp message if not replaced within 10 seconds
    setTimeout(() => {
      setLocalMessages(prev => {
        const stillTemp = prev.find(m => m.id === tempMessage.id);
        if (stillTemp) {
          console.warn('Temp message not replaced, removing:', tempMessage.id);
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

  const handleTyping = () => {
    if (!selectedConversation || !user) return;

    // Clear previous timeout
    if (typingTimeout) clearTimeout(typingTimeout);

    // Send typing indicator
    supabase.channel(`typing:${selectedConversation.id}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, conversationId: selectedConversation.id }
      });

    // Set new timeout
    const timeout = setTimeout(() => {
      // Typing stopped
    }, 3000);
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
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedConversation?.id === conversation.id ? 'bg-muted' : ''
                }`}
                onClick={() => handleSelectConversation(conversation)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conversation.other_user?.avatar_url} />
                    <AvatarFallback>
                      {conversation.other_user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">
                      {conversation.other_user?.display_name || 'Unknown User'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))
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
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
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
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                        <div
                          className={`rounded-lg p-3 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          } ${isTemp ? 'opacity-70' : ''}`}
                        >
                          {message.image_url && (
                            <div 
                              className="cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewerImage(message.image_url!)}
                            >
                              <img
                                src={message.image_url}
                                alt="Message attachment"
                                className="w-full rounded-md mb-2 max-h-48 object-cover hover:scale-[1.02] transition-transform"
                              />
                            </div>
                          )}
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                          {isTemp ? 'Sending...' : formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
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
    </div>
  );
};