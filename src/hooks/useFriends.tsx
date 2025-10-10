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
  };
  receiver_profile?: {
    display_name: string;
    avatar_url?: string;
    school?: string;
    major?: string;
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

  const fetchFriends = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      // Get friend profiles separately
      const friendsWithProfiles = await Promise.all(
        (data || []).map(async (friendship: any) => {
          const friendUserId = friendship.user1_id === user.id ? friendship.user2_id : friendship.user1_id;
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, user_id, display_name, avatar_url, school, major, bio')
            .eq('user_id', friendUserId)
            .maybeSingle();
          
          if (profileError) {
            console.error('Error fetching friend profile:', profileError);
          }
          if (!profile) {
            console.warn(`No profile found for user: ${friendUserId}`);
          }
          
          return {
            ...friendship,
            friend_profile: profile
          };
        })
      );

      setFriends(friendsWithProfiles);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;

    try {
      // Incoming requests  
      const { data: incoming, error: incomingError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (incomingError) throw incomingError;

      // Get sender profiles separately
      const incomingWithProfiles = await Promise.all(
        (incoming || []).map(async (request: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, school, major')
            .eq('user_id', request.sender_id)
            .single();
          
          return {
            ...request,
            status: request.status as 'pending' | 'accepted' | 'rejected',
            sender_profile: profile
          };
        })
      );

      // Outgoing requests
      const { data: outgoing, error: outgoingError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('sender_id', user.id)
        .eq('status', 'pending');

      if (outgoingError) throw outgoingError;

      // Get receiver profiles separately
      const outgoingWithProfiles = await Promise.all(
        (outgoing || []).map(async (request: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, school, major')
            .eq('user_id', request.receiver_id)
            .single();
          
          return {
            ...request,
            status: request.status as 'pending' | 'accepted' | 'rejected',
            receiver_profile: profile
          };
        })
      );

      setFriendRequests(incomingWithProfiles);
      setSentRequests(outgoingWithProfiles);
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

        await fetchFriends();
      }

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
      setLoading(true);
      Promise.all([fetchFriends(), fetchFriendRequests()]).finally(() => {
        setLoading(false);
      });
    }
  }, [user]);

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