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

// Helper to load from localStorage
const loadFromCache = () => {
  try {
    const cached = localStorage.getItem('friends-cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        friends: parsed.friends || [],
        friendRequests: parsed.friendRequests || [],
        sentRequests: parsed.sentRequests || []
      };
    }
  } catch (error) {
    console.error('Error loading friends cache:', error);
  }
  return { friends: [], friendRequests: [], sentRequests: [] };
};

export const useFriends = () => {
  const { user } = useAuth();
  const initialCache = loadFromCache();
  const [friends, setFriends] = useState<Friend[]>(initialCache.friends);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(initialCache.friendRequests);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>(initialCache.sentRequests);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [isFetching, setIsFetching] = useState(false);
  
  // Cache duration: 5 minutes
  const CACHE_DURATION = 300000;

  const fetchFriends = async () => {
    if (!user || isFetching) return;
    
    setIsFetching(true);
    try {
      // Step 1: Get all friendships for this user
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (friendshipsError) throw friendshipsError;
      
      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setLastFetchTime(Date.now());
        return;
      }

      // Step 2: Get all friend user IDs
      const friendUserIds = friendships.map(f => 
        f.user1_id === user.id ? f.user2_id : f.user1_id
      );

      // Step 3: Batch fetch all friend profiles in one query
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, school, major, bio')
        .in('user_id', friendUserIds);

      if (profilesError) throw profilesError;

      // Step 4: Map friendships with profiles
      const friendsWithProfiles: Friend[] = friendships.map(friendship => {
        const friendUserId = friendship.user1_id === user.id 
          ? friendship.user2_id 
          : friendship.user1_id;
        
        const friend_profile = profiles?.find(p => p.user_id === friendUserId);

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
      
      // Save to localStorage for instant loading
      try {
        const currentCache = loadFromCache();
        localStorage.setItem('friends-cache', JSON.stringify({
          friends: friendsWithProfiles,
          friendRequests: currentCache.friendRequests,
          sentRequests: currentCache.sentRequests
        }));
      } catch (error) {
        console.error('Error saving friends cache:', error);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;

    try {
      // Parallel queries for incoming and outgoing
      const [incomingResult, outgoingResult] = await Promise.all([
        supabase
          .from('friend_requests')
          .select('*')
          .eq('receiver_id', user.id)
          .eq('status', 'pending'),
        
        supabase
          .from('friend_requests')
          .select('*')
          .eq('sender_id', user.id)
          .eq('status', 'pending')
      ]);

      if (incomingResult.error) throw incomingResult.error;
      if (outgoingResult.error) throw outgoingResult.error;

      const incomingData = incomingResult.data || [];
      const outgoingData = outgoingResult.data || [];

      // Batch fetch all profiles in one query
      const allUserIds = [
        ...incomingData.map(r => r.sender_id),
        ...outgoingData.map(r => r.receiver_id)
      ];

      if (allUserIds.length === 0) {
        setFriendRequests([]);
        setSentRequests([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, school, major, bio')
        .in('user_id', allUserIds);

      if (profilesError) throw profilesError;

      // Map incoming requests with sender profiles
      const incomingWithProfiles = incomingData.map(request => ({
        ...request,
        status: request.status as 'pending' | 'accepted' | 'rejected',
        sender_profile: profiles?.find(p => p.user_id === request.sender_id) || {
          display_name: 'Unknown User',
          avatar_url: null,
          school: null,
          major: null,
          user_id: request.sender_id
        }
      }));

      // Map outgoing requests with receiver profiles
      const outgoingWithProfiles = outgoingData.map(request => ({
        ...request,
        status: request.status as 'pending' | 'accepted' | 'rejected',
        receiver_profile: profiles?.find(p => p.user_id === request.receiver_id) || {
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
      
      // Save to localStorage for instant loading
      try {
        const currentCache = loadFromCache();
        localStorage.setItem('friends-cache', JSON.stringify({
          friends: currentCache.friends,
          friendRequests: incomingWithProfiles,
          sentRequests: outgoingWithProfiles
        }));
      } catch (error) {
        console.error('Error saving requests cache:', error);
      }
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
      }
    } else {
      // Clear cache on logout
      localStorage.removeItem('friends-cache');
      setFriends([]);
      setFriendRequests([]);
      setSentRequests([]);
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
          filter: `user1_id=eq.${user.id}`
        },
        () => {
          console.log('🔄 Friendship change detected (user1)');
          setLastFetchTime(0);
          fetchFriends();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user2_id=eq.${user.id}`
        },
        () => {
          console.log('🔄 Friendship change detected (user2)');
          setLastFetchTime(0);
          fetchFriends();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${user.id}`
        },
        () => {
          console.log('🔄 Friend request change detected (sender)');
          setLastFetchTime(0);
          fetchFriendRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          console.log('🔄 Friend request change detected (receiver)');
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