import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';

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
      console.error('Error updating presence:', error);
    } else {
      setCurrentUserStatus(status);
    }
  };

  // Send heartbeat to keep presence fresh
  const sendHeartbeat = async () => {
    if (!user || currentUserStatus === 'offline') return;
    
    console.log('Sending presence heartbeat...');
    
    // Update last_seen timestamp
    const { error } = await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status: currentUserStatus,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error sending heartbeat:', error);
    }
    
    // Also trigger cleanup of stale users
    const { error: cleanupError } = await supabase.rpc('cleanup_stale_presence');
    if (cleanupError) {
      console.error('Error cleaning up stale presence:', cleanupError);
    }
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
      console.error('Error loading saved status:', error);
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
      console.error('Error marking notification as read:', error);
    }
  };

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    console.log('Setting up realtime subscriptions...');

    // Subscribe to user presence changes
    const presenceChannel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          console.log('Presence change:', payload);
          const presence = payload.new as UserPresence;
          if (presence) {
            setUserStatuses(prev => ({
              ...prev,
              [presence.user_id]: presence
            }));
            
            // Update current user status if this is their presence change
            if (presence.user_id === user.id) {
              setCurrentUserStatus(presence.status);
            }
          }
          // Refresh online users list
          loadOnlineUsers();
        }
      )
      .subscribe();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('realtime-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New message received:', payload);
          toast({
            title: "New Message",
            description: "You have received a new message",
          });
          loadUnreadCount();
        }
      )
      .subscribe();

    // Subscribe to friend requests
    const friendRequestsChannel = supabase
      .channel('realtime-friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New friend request:', payload);
          toast({
            title: "New Friend Request",
            description: "Someone wants to be your friend!",
          });
          loadUnreadCount();
        }
      )
      .subscribe();

    // Subscribe to friend request responses
    const friendResponsesChannel = supabase
      .channel('realtime-friend-responses')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Friend request response:', payload);
          if (payload.new.status === 'accepted') {
            toast({
              title: "Friend Request Accepted",
              description: "Your friend request was accepted!",
            });
          }
        }
      )
      .subscribe();

    // Subscribe to post likes
    const likesChannel = supabase
      .channel('realtime-likes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_likes'
        },
        (payload) => {
          console.log('New like:', payload);
          // You could add notification logic here for post authors
        }
      )
      .subscribe();

    // Subscribe to notifications
    const notificationsChannel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification:', payload);
          loadUnreadCount();
          
          // Show toast for new notifications
          const notification = payload.new;
          toast({
            title: notification.title,
            description: notification.message,
          });
        }
      )
      .subscribe();

    // Load saved status preference first, then set user as online if no preference
    loadUserSavedStatus().then(savedStatus => {
      if (savedStatus) {
        setHasManualStatus(true);
        updatePresence(savedStatus);
      } else {
        updatePresence('online');
      }
    });

    // Start heartbeat interval (every 60 seconds)
    const interval = setInterval(() => {
      sendHeartbeat();
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

    // Set up pagehide handler (more reliable than beforeunload)
    const handlePageHide = () => {
      updatePresence('offline');
    };

    window.addEventListener('pagehide', handlePageHide);

    // Cleanup function
    return () => {
      console.log('Cleaning up realtime subscriptions...');
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(friendRequestsChannel);
      supabase.removeChannel(friendResponsesChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(notificationsChannel);
      
      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      
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
      console.error('Error loading online users:', error);
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
      console.error('Error loading user statuses:', error);
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
      
      // Set current user status if found
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