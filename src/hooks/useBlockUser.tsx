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
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          id,
          blocked_id,
          created_at,
          profiles:blocked_id (
            display_name,
            avatar_url,
            school,
            major
          )
        `)
        .eq('blocker_id', user.id);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        blockId: row.id,
        userId: row.blocked_id,
        displayName: row.profiles?.display_name,
        avatarUrl: row.profiles?.avatar_url,
        school: row.profiles?.school,
        major: row.profiles?.major,
        blockedAt: row.created_at,
      }));
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
