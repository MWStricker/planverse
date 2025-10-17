import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export const useBlockUser = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const blockUser = async (userId: string): Promise<boolean> => {
    if (!user || userId === user.id) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user.id,
          blocked_id: userId,
        });

      if (error) throw error;

      toast({
        title: "User blocked",
        description: "You won't see posts or messages from this user anymore.",
      });

      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: "Error",
        description: "Failed to block user. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (userId: string): Promise<boolean> => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);

      if (error) throw error;

      toast({
        title: "User unblocked",
        description: "You can now see posts and messages from this user.",
      });

      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast({
        title: "Error",
        description: "Failed to unblock user. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getBlockedUsers = async (): Promise<string[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (error) throw error;

      return data.map(row => row.blocked_id);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
  };

  const isUserBlocked = async (userId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId)
        .maybeSingle();

      if (error) throw error;

      return !!data;
    } catch (error) {
      console.error('Error checking blocked status:', error);
      return false;
    }
  };

  const getBlockedUsersWithProfiles = async (): Promise<any[]> => {
    if (!user) return [];

    try {
      // First, get all blocked user IDs
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_users')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user.id);

      if (blockedError) throw blockedError;
      if (!blockedData || blockedData.length === 0) return [];

      // Extract the blocked user IDs
      const blockedUserIds = blockedData.map(row => row.blocked_id);

      // Fetch profiles for all blocked users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, school, major')
        .in('user_id', blockedUserIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile data for easy lookup
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.user_id, profile])
      );

      // Combine blocked users with their profile data
      return blockedData.map(row => {
        const profile = profilesMap.get(row.blocked_id);
        return {
          blockId: row.id,
          userId: row.blocked_id,
          displayName: profile?.display_name || null,
          avatarUrl: profile?.avatar_url || null,
          school: profile?.school || null,
          major: profile?.major || null,
          blockedAt: row.created_at,
        };
      });
    } catch (error) {
      console.error('Error fetching blocked users with profiles:', error);
      return [];
    }
  };

  return {
    blockUser,
    unblockUser,
    getBlockedUsers,
    isUserBlocked,
    getBlockedUsersWithProfiles,
    loading,
  };
};
