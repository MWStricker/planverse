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

  // Get user status
  const getUserStatus = (userId: string): 'online' | 'idle' | 'dnd' | 'offline' => {
    return userStatuses[userId]?.status || 'offline';
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

    // Set user as online when component mounts
    updatePresence('online');

    // Load initial data
    loadOnlineUsers();
    loadUnreadCount();
    loadUserStatuses();

    // Set up visibility change handler
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('idle');
      } else {
        updatePresence('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up beforeunload handler
    const handleBeforeUnload = () => {
      updatePresence('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      console.log('Cleaning up realtime subscriptions...');
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(friendRequestsChannel);
      supabase.removeChannel(friendResponsesChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(notificationsChannel);
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      updatePresence('offline');
    };
  }, [user]);

  // Load online users
  const loadOnlineUsers = async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id')
      .eq('status', 'online')
      .gte('last_seen', fiveMinutesAgo);

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