import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  userReacted: boolean;
  users: { id: string; display_name: string; avatar_url?: string }[];
}

export const useReactions = (messageId?: string) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<ReactionCount[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReactions = async (msgId: string) => {
    if (!msgId) return;

    try {
      setLoading(true);
      
      // Fetch reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('reactions')
        .select('*')
        .eq('message_id', msgId);

      if (reactionsError) {
        console.error('Error fetching reactions:', reactionsError);
        throw reactionsError;
      }

      if (!reactionsData || reactionsData.length === 0) {
        setReactions([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(reactionsData.map(r => r.user_id))];

      // Fetch profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of user_id to profile
      const profileMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      // Group by emoji
      const grouped = reactionsData.reduce((acc: Record<string, ReactionCount>, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = {
            emoji: reaction.emoji,
            count: 0,
            userReacted: false,
            users: []
          };
        }
        acc[reaction.emoji].count++;
        acc[reaction.emoji].userReacted = acc[reaction.emoji].userReacted || reaction.user_id === user?.id;
        
        const profile = profileMap.get(reaction.user_id);
        acc[reaction.emoji].users.push({
          id: reaction.user_id,
          display_name: profile?.display_name || 'Unknown',
          avatar_url: profile?.avatar_url
        });
        return acc;
      }, {});

      setReactions(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching reactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addReaction = async (msgId: string, emoji: string) => {
    if (!user) {
      console.error('❌ addReaction: No user logged in');
      return;
    }

    try {
      console.log('🔵 addReaction START:', { msgId, emoji, userId: user.id });
      
      // Check if user already reacted to this message
      const { data: existing, error: fetchError } = await supabase
        .from('reactions')
        .select('id, emoji')
        .eq('message_id', msgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Error fetching existing reaction:', fetchError);
        throw fetchError;
      }

      console.log('📋 Existing reaction:', existing);

      if (existing) {
        // Update existing reaction
        if (existing.emoji === emoji) {
          // Remove if same emoji
          console.log('🗑️ Removing reaction (same emoji)');
          await removeReaction(msgId);
        } else {
          // Change to new emoji
          console.log('🔄 Updating reaction to new emoji');
          const { error } = await supabase
            .from('reactions')
            .update({ emoji })
            .eq('id', existing.id);
          
          if (error) {
            console.error('❌ Error updating reaction:', error);
            throw error;
          }
          console.log('✅ Reaction updated successfully');
        }
      } else {
        // Add new reaction
        console.log('➕ Inserting new reaction:', { message_id: msgId, user_id: user.id, emoji });
        const { data, error } = await supabase
          .from('reactions')
          .insert({
            message_id: msgId,
            user_id: user.id,
            emoji
          })
          .select();
        
        if (error) {
          console.error('❌ Error inserting reaction:', error);
          console.error('❌ Error details:', JSON.stringify(error, null, 2));
          throw error;
        }
        console.log('✅ Reaction inserted successfully:', data);
      }

      console.log('🔄 Fetching updated reactions...');
      await fetchReactions(msgId);
      console.log('🔵 addReaction COMPLETE');
    } catch (error) {
      console.error('❌ addReaction FAILED:', error);
    }
  };

  const removeReaction = async (msgId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('reactions')
        .delete()
        .eq('message_id', msgId)
        .eq('user_id', user.id);

      await fetchReactions(msgId);
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  useEffect(() => {
    if (!messageId || !user) return;

    fetchReactions(messageId);

    // Subscribe to reaction changes
    const channel = supabase
      .channel(`reactions:${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `message_id=eq.${messageId}`
        },
        () => {
          fetchReactions(messageId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, user]);

  return {
    reactions,
    loading,
    addReaction,
    removeReaction,
    fetchReactions
  };
};
