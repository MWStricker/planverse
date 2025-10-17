import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';
import { monitoring } from '@/lib/monitoring';

interface UserPresence {
  user_id: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  last_seen: string;
}

interface RealtimeContextType {
  onlineUsers: string[];
  unreadCount: number;
  userStatuses: Record<string, UserPresence>;
  currentUserStatus: 'online' | 'idle' | 'dnd' | 'offline';
  markNotificationAsRead: (notificationId: string) => void;
  updatePresence: (status: 'online' | 'idle' | 'dnd' | 'offline') => void;
  getUserStatus: (userId: string) => 'online' | 'idle' | 'dnd' | 'offline';
}

const RealtimeContext = createContext<RealtimeContextType>({
  onlineUsers: [],
  unreadCount: 0,
  userStatuses: {},
  currentUserStatus: 'offline',
  markNotificationAsRead: () => {},
  updatePresence: () => {},
  getUserStatus: () => 'offline'
});

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  return context;
};

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserPresence>>({});
  const [currentUserStatus, setCurrentUserStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>('offline');
  const [hasManualStatus, setHasManualStatus] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [reconnectAttempts, setReconnectAttempts] = useState<Record<string, number>>({});
  
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RETRY_DELAY = 1000;
  const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  // Calculate exponential backoff delay
  const getRetryDelay = (attempt: number): number => {
    return Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt), 30000); // Max 30 seconds
  };

  // Update user presence
  const updatePresence = async (status: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (!user) return;

    const { error } = await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error) {
      monitoring.log('error', 'Error updating presence', { error: error.message });
    } else {
      setCurrentUserStatus(status);
    }
  };

  // Smart heartbeat - only update if active and visible
  const sendHeartbeat = async () => {
    if (!user || currentUserStatus === 'offline') return;
    
    // Only send heartbeat if tab is visible
    if (document.hidden) {
      console.log('⏸️ Skipping heartbeat - tab hidden');
      return;
    }
    
    console.log('💓 Sending presence heartbeat...');
    
    // Update last_seen timestamp - only if status matches current
    const { error } = await supabase
      .from('user_presence')
      .update({
        last_seen: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('status', currentUserStatus);

    if (error) {
      monitoring.log('error', 'Error sending heartbeat', { error: error.message });
    }
    
    // Also trigger cleanup of stale users
    const { error: cleanupError } = await supabase.rpc('cleanup_stale_presence');
    if (cleanupError) {
      monitoring.log('warn', 'Error cleaning up stale presence', { error: cleanupError.message });
    }
  };

  // Channel setup with retry logic
  const setupChannelWithRetry = async (
    channelName: string,
    setupFn: () => any,
    maxAttempts = MAX_RECONNECT_ATTEMPTS
  ) => {
    const attemptConnection = async (attempt: number = 0): Promise<any> => {
      try {
        console.log(`🔌 Connecting ${channelName} (attempt ${attempt + 1}/${maxAttempts})`);
        
        const channel = setupFn();
        
        // Listen for channel errors
        channel.on('system', {}, (payload: any) => {
          if (payload.status === 'error') {
            monitoring.log('error', `Channel ${channelName} error`, { payload });
            
            if (attempt < maxAttempts - 1) {
              const delay = getRetryDelay(attempt);
              console.log(`⏱️ Retrying ${channelName} in ${delay}ms...`);
              
              setTimeout(() => {
                attemptConnection(attempt + 1);
              }, delay);
            } else {
              monitoring.log('error', `Max reconnection attempts reached for ${channelName}`);
              toast({
                title: "Connection Issue",
                description: "Lost connection to real-time updates. Please refresh the page.",
                variant: "destructive"
              });
            }
          }
        });
        
        // Track successful connection
        setReconnectAttempts(prev => ({ ...prev, [channelName]: 0 }));
        return channel;
        
      } catch (error) {
        monitoring.log('error', `Error setting up ${channelName}`, { error });
        
        if (attempt < maxAttempts - 1) {
          const delay = getRetryDelay(attempt);
          console.log(`⏱️ Retrying ${channelName} in ${delay}ms...`);
          setReconnectAttempts(prev => ({ ...prev, [channelName]: attempt + 1 }));
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptConnection(attempt + 1);
        }
        
        throw error;
      }
    };
    
    return attemptConnection();
  };

  // Load user's saved status preference
  const loadUserSavedStatus = async (): Promise<'online' | 'idle' | 'dnd' | 'offline' | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('status_preference')
        .eq('user_id', user.id)
        .single();

      if (error || !data?.status_preference) return null;
      return data.status_preference as 'online' | 'idle' | 'dnd' | 'offline';
    } catch (error) {
      monitoring.log('warn', 'Error loading saved status', { error });
      return null;
    }
  };

  // Get user status with freshness check
  const getUserStatus = (userId: string): 'online' | 'idle' | 'dnd' | 'offline' => {
    const userPresence = userStatuses[userId];
    if (!userPresence) return 'offline';
    
    // Check if last_seen is within 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const lastSeen = new Date(userPresence.last_seen);
    
    // If last seen is too old, consider offline regardless of stored status
    if (lastSeen < twoMinutesAgo) {
      return 'offline';
    }
    
    return userPresence.status;
  };

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      monitoring.log('error', 'Error marking notification as read', { error: error.message });
    }
  };

  // Set up realtime subscriptions with consolidated channels
  useEffect(() => {
    if (!user) return;

    console.log('Setting up realtime subscriptions...');
    monitoring.log('info', 'Setting up realtime subscriptions', { userId: user.id });

    let mainChannel: any;
    let socialChannel: any;

    const initializeChannels = async () => {
      try {
        // Main channel: presence, messages, notifications
        mainChannel = await setupChannelWithRetry(
          'main-realtime',
          () => supabase
            .channel('main-realtime')
            // Presence changes
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'user_presence'
            }, (payload) => {
              console.log('Presence change:', payload);
              const presence = payload.new as UserPresence;
              if (presence) {
                setUserStatuses(prev => ({
                  ...prev,
                  [presence.user_id]: presence
                }));
                
                if (presence.user_id === user.id) {
                  setCurrentUserStatus(presence.status);
                }
              }
              loadOnlineUsers();
            })
            // New messages
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `receiver_id=eq.${user.id}`
            }, (payload) => {
              console.log('New message received:', payload);
              toast({
                title: "New Message",
                description: "You have received a new message",
              });
              loadUnreadCount();
            })
            // Notifications
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`
            }, (payload) => {
              console.log('New notification:', payload);
              loadUnreadCount();
              
              const notification = payload.new;
              toast({
                title: notification.title,
                description: notification.message,
              });
            })
            .subscribe()
        );

        // Social channel: friend requests, likes
        socialChannel = await setupChannelWithRetry(
          'social-realtime',
          () => supabase
            .channel('social-realtime')
            // Friend requests
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'friend_requests',
              filter: `receiver_id=eq.${user.id}`
            }, (payload) => {
              console.log('New friend request:', payload);
              toast({
                title: "New Friend Request",
                description: "Someone wants to be your friend!",
              });
              loadUnreadCount();
            })
            // Friend request responses
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'friend_requests',
              filter: `sender_id=eq.${user.id}`
            }, (payload) => {
              console.log('Friend request response:', payload);
              if (payload.new.status === 'accepted') {
                toast({
                  title: "Friend Request Accepted",
                  description: "Your friend request was accepted!",
                });
              }
            })
            // Post likes
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'post_likes'
            }, (payload) => {
              console.log('New like:', payload);
            })
            .subscribe()
        );

        monitoring.log('info', 'Realtime channels connected successfully');
      } catch (error) {
        monitoring.log('error', 'Failed to initialize realtime channels', { error });
      }
    };

    initializeChannels();

    // Load saved status preference first, then set user as online if no preference
    loadUserSavedStatus().then(savedStatus => {
      if (savedStatus) {
        setHasManualStatus(true);
        updatePresence(savedStatus);
      } else {
        updatePresence('online');
      }
    });

    // Activity tracking
    const updateActivity = () => {
      setLastActivityTime(Date.now());
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    // Smart heartbeat interval with activity detection
    const interval = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityTime;
      
      if (timeSinceActivity > IDLE_THRESHOLD && currentUserStatus !== 'idle' && !hasManualStatus) {
        // Auto-transition to idle after 5 minutes of inactivity
        updatePresence('idle');
      } else {
        sendHeartbeat();
      }
    }, 60000); // 60 seconds

    setHeartbeatInterval(interval);

    // Send immediate heartbeat on mount
    sendHeartbeat();

    // Load initial data
    loadOnlineUsers();
    loadUnreadCount();
    loadUserStatuses();

    // Set up visibility change handler - only if user hasn't manually set status
    const handleVisibilityChange = () => {
      if (!hasManualStatus) {
        if (document.hidden) {
          updatePresence('idle');
        } else {
          updatePresence('online');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up pagehide handler
    const handlePageHide = () => {
      updatePresence('offline');
    };

    window.addEventListener('pagehide', handlePageHide);

    // Cleanup function
    return () => {
      console.log('Cleaning up realtime subscriptions...');
      monitoring.log('info', 'Cleaning up realtime subscriptions');
      
      if (mainChannel) supabase.removeChannel(mainChannel);
      if (socialChannel) supabase.removeChannel(socialChannel);
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      
      updatePresence('offline');
    };
  }, [user]);

  // Load online users - only consider users seen in last 2 minutes
  const loadOnlineUsers = async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id')
      .eq('status', 'online')
      .gte('last_seen', twoMinutesAgo);

    if (error) {
      monitoring.log('error', 'Error loading online users', { error: error.message });
    } else {
      setOnlineUsers(data.map(item => item.user_id));
    }
  };

  // Load unread count (messages + notifications)
  const loadUnreadCount = async () => {
    if (!user) return;

    const [messagesResult, notificationsResult] = await Promise.all([
      supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('is_read', false),
      supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('read', false)
    ]);

    const unreadMessages = messagesResult.data?.length || 0;
    const unreadNotifications = notificationsResult.data?.length || 0;
    
    setUnreadCount(unreadMessages + unreadNotifications);
  };

  // Load initial user statuses
  const loadUserStatuses = async () => {
    const { data, error } = await supabase
      .from('user_presence')
      .select('*');
    
    if (error) {
      monitoring.log('error', 'Error loading user statuses', { error: error.message });
    } else if (data) {
      const statusMap = data.reduce((acc, presence) => {
        const userPresence: UserPresence = {
          user_id: presence.user_id,
          status: presence.status as 'online' | 'idle' | 'dnd' | 'offline',
          last_seen: presence.last_seen
        };
        acc[presence.user_id] = userPresence;
        return acc;
      }, {} as Record<string, UserPresence>);
      setUserStatuses(statusMap);
      
      if (user?.id && statusMap[user.id]) {
        setCurrentUserStatus(statusMap[user.id].status);
      }
    }
  };

  const value = {
    onlineUsers,
    unreadCount,
    userStatuses,
    currentUserStatus,
    markNotificationAsRead,
    updatePresence,
    getUserStatus
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};
