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
      const { data, error } = await supabase
        .from('reactions')
        .select(`
          *,
          profiles:user_id(user_id, display_name, avatar_url)
        `)
        .eq('message_id', msgId);

      if (error) throw error;

      // Group by emoji
      const grouped = data?.reduce((acc: Record<string, ReactionCount>, reaction: any) => {
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
        acc[reaction.emoji].users.push({
          id: reaction.user_id,
          display_name: reaction.profiles?.display_name || 'Unknown',
          avatar_url: reaction.profiles?.avatar_url
        });
        return acc;
      }, {});

      setReactions(Object.values(grouped || {}));
    } catch (error) {
      console.error('Error fetching reactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addReaction = async (msgId: string, emoji: string) => {
    if (!user) return;

    try {
      // Check if user already reacted to this message
      const { data: existing } = await supabase
        .from('reactions')
        .select('id, emoji')
        .eq('message_id', msgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing reaction
        if (existing.emoji === emoji) {
          // Remove if same emoji
          await removeReaction(msgId);
        } else {
          // Change to new emoji
          await supabase
            .from('reactions')
            .update({ emoji })
            .eq('id', existing.id);
        }
      } else {
        // Add new reaction
        await supabase
          .from('reactions')
          .insert({
            message_id: msgId,
            user_id: user.id,
            emoji
          });
      }

      await fetchReactions(msgId);
    } catch (error) {
      console.error('Error adding reaction:', error);
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
