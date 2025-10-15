import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender_profile?: {
    display_name: string;
    avatar_url?: string;
    school?: string;
    major?: string;
    user_id?: string;
  };
  receiver_profile?: {
    display_name: string;
    avatar_url?: string;
    school?: string;
    major?: string;
    user_id?: string;
  };
}

export interface Friend {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  friend_profile?: {
    id: string;
    user_id: string;
    display_name: string;
    avatar_url?: string;
    school?: string;
    major?: string;
    bio?: string;
  };
}

export const useFriends = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  // Cache duration: 30 seconds
  const CACHE_DURATION = 30000;

  const fetchFriends = async () => {
    if (!user) return;

    try {
      // Single optimized query with PostgreSQL join - fetches friendships and profiles in one go
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          *,
          user1_profile:profiles!friendships_user1_id_fkey(id, user_id, display_name, avatar_url, school, major, bio),
          user2_profile:profiles!friendships_user2_id_fkey(id, user_id, display_name, avatar_url, school, major, bio)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      // Map to determine which profile is the friend's profile
      const friendsWithProfiles = (data || []).map((friendship: any) => {
        const friend_profile = friendship.user1_id === user.id 
          ? friendship.user2_profile 
          : friendship.user1_profile;

        return {
          id: friendship.id,
          user1_id: friendship.user1_id,
          user2_id: friendship.user2_id,
          created_at: friendship.created_at,
          friend_profile
        };
      });

      setFriends(friendsWithProfiles);
      setLastFetchTime(Date.now());
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;

    try {
      // Parallel fetch with PostgreSQL joins for both incoming and outgoing requests
      const [incomingResult, outgoingResult] = await Promise.all([
        supabase
          .from('friend_requests')
          .select(`
            *,
            sender_profile:profiles!friend_requests_sender_id_fkey(display_name, avatar_url, school, major, user_id)
          `)
          .eq('receiver_id', user.id)
          .eq('status', 'pending'),
        
        supabase
          .from('friend_requests')
          .select(`
            *,
            receiver_profile:profiles!friend_requests_receiver_id_fkey(display_name, avatar_url, school, major, user_id)
          `)
          .eq('sender_id', user.id)
          .eq('status', 'pending')
      ]);

      if (incomingResult.error) throw incomingResult.error;
      if (outgoingResult.error) throw outgoingResult.error;

      // Map with default values for missing profiles
      const incomingWithProfiles = (incomingResult.data || []).map((request: any) => ({
        ...request,
        status: request.status as 'pending' | 'accepted' | 'rejected',
        sender_profile: request.sender_profile || {
          display_name: 'Unknown User',
          avatar_url: null,
          school: null,
          major: null,
          user_id: request.sender_id
        }
      }));

      const outgoingWithProfiles = (outgoingResult.data || []).map((request: any) => ({
        ...request,
        status: request.status as 'pending' | 'accepted' | 'rejected',
        receiver_profile: request.receiver_profile || {
          display_name: 'Unknown User',
          avatar_url: null,
          school: null,
          major: null,
          user_id: request.receiver_id
        }
      }));

      setFriendRequests(incomingWithProfiles);
      setSentRequests(outgoingWithProfiles);
      setLastFetchTime(Date.now());
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!user || receiverId === user.id) return false;

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          status: 'pending'
        });

      if (error) throw error;

      // Force refetch (bypass cache) after user action
      setLastFetchTime(0);
      await fetchFriendRequests();
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      return false;
    }
  };

  const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    if (!user) return false;

    try {
      const status = accept ? 'accepted' : 'rejected';
      
      const { data, error } = await supabase
        .from('friend_requests')
        .update({ status })
        .eq('id', requestId)
        .eq('receiver_id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (accept && data) {
        // Create friendship
        const user1 = data.sender_id < user.id ? data.sender_id : user.id;
        const user2 = data.sender_id < user.id ? user.id : data.sender_id;

        await supabase
          .from('friendships')
          .insert({
            user1_id: user1,
            user2_id: user2
          });

        // Force refetch (bypass cache) after user action
        setLastFetchTime(0);
        await fetchFriends();
      }

      // Force refetch (bypass cache) after user action
      setLastFetchTime(0);
      await fetchFriendRequests();
      return true;
    } catch (error) {
      console.error('Error responding to friend request:', error);
      return false;
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      // Force refetch (bypass cache) after user action
      setLastFetchTime(0);
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  };

  const checkFriendshipStatus = async (otherUserId: string) => {
    if (!user || otherUserId === user.id) return 'none';

    try {
      // Check if already friends
      const user1 = user.id < otherUserId ? user.id : otherUserId;
      const user2 = user.id < otherUserId ? otherUserId : user.id;

      const { data: friendship } = await supabase
        .from('friendships')
        .select('id')
        .eq('user1_id', user1)
        .eq('user2_id', user2)
        .single();

      if (friendship) return 'friends';

      // Check for pending requests
      const { data: sentRequest } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', user.id)
        .eq('receiver_id', otherUserId)
        .eq('status', 'pending')
        .single();

      if (sentRequest) return 'sent';

      const { data: receivedRequest } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', otherUserId)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .single();

      if (receivedRequest) return 'received';

      return 'none';
    } catch (error) {
      console.error('Error checking friendship status:', error);
      return 'none';
    }
  };

  useEffect(() => {
    if (user) {
      // Check cache before fetching
      const now = Date.now();
      const isCacheValid = lastFetchTime > 0 && (now - lastFetchTime) < CACHE_DURATION;
      
      if (!isCacheValid) {
        setLoading(true);
        Promise.all([fetchFriends(), fetchFriendRequests()]).finally(() => {
          setLoading(false);
        });
      } else {
        // Data is cached, just clear loading state
        setLoading(false);
      }
    }
  }, [user]);

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('friendships-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user1_id=eq.${user.id},user2_id=eq.${user.id}`
        },
        () => {
          // Invalidate cache and refetch on friendship changes
          setLastFetchTime(0);
          fetchFriends();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests'
        },
        () => {
          // Invalidate cache and refetch on friend request changes
          setLastFetchTime(0);
          fetchFriendRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    friends,
    friendRequests,
    sentRequests,
    loading,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend,
    checkFriendshipStatus,
    refetch: () => {
      fetchFriends();
      fetchFriendRequests();
    }
  };
};