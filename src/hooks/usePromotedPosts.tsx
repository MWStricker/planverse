import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface PromotedPost {
  id: string;
  post_id: string;
  user_id: string;
  promotion_budget: number;
  stripe_payment_intent_id?: string | null;
  payment_status: string;
  promotion_duration_days: number;
  target_impressions?: number | null;
  target_engagement_rate?: number | null;
  status: string;
  moderation_status: string;
  moderation_notes?: string | null;
  moderated_by?: string | null;
  moderated_at?: string | null;
  total_impressions: number;
  total_clicks: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  engagement_rate: number;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const usePromotedPosts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [promotedPosts, setPromotedPosts] = useState<PromotedPost[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPromotedPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promoted_posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotedPosts(data || []);
    } catch (error) {
      console.error('Error fetching promoted posts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch promoted posts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPromotedPosts();
    }
  }, [user]);

  const createPromotion = async (
    postId: string,
    budget: number,
    durationDays: number
  ): Promise<{ success: boolean; clientSecret?: string; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-promotion', {
        body: {
          postId,
          budget,
          durationDays
        }
      });

      if (error) throw error;

      if (data.success) {
        await fetchPromotedPosts();
        return { success: true, clientSecret: data.clientSecret };
      }

      return { success: false, error: data.error };
    } catch (error: any) {
      console.error('Error creating promotion:', error);
      return { success: false, error: error.message };
    }
  };

  const pausePromotion = async (promotionId: string) => {
    try {
      const { error } = await supabase
        .from('promoted_posts')
        .update({ status: 'paused' })
        .eq('id', promotionId);

      if (error) throw error;

      toast({
        title: "Promotion paused",
        description: "Your promotion has been paused successfully"
      });

      await fetchPromotedPosts();
    } catch (error) {
      console.error('Error pausing promotion:', error);
      toast({
        title: "Error",
        description: "Failed to pause promotion",
        variant: "destructive"
      });
    }
  };

  const resumePromotion = async (promotionId: string) => {
    try {
      const { error } = await supabase
        .from('promoted_posts')
        .update({ status: 'active' })
        .eq('id', promotionId);

      if (error) throw error;

      toast({
        title: "Promotion resumed",
        description: "Your promotion is now active again"
      });

      await fetchPromotedPosts();
    } catch (error) {
      console.error('Error resuming promotion:', error);
      toast({
        title: "Error",
        description: "Failed to resume promotion",
        variant: "destructive"
      });
    }
  };

  const cancelPromotion = async (promotionId: string) => {
    try {
      const { error } = await supabase
        .from('promoted_posts')
        .update({ status: 'cancelled' })
        .eq('id', promotionId);

      if (error) throw error;

      toast({
        title: "Promotion cancelled",
        description: "Your promotion has been cancelled"
      });

      await fetchPromotedPosts();
    } catch (error) {
      console.error('Error cancelling promotion:', error);
      toast({
        title: "Error",
        description: "Failed to cancel promotion",
        variant: "destructive"
      });
    }
  };

  return {
    promotedPosts,
    loading,
    fetchPromotedPosts,
    createPromotion,
    pausePromotion,
    resumePromotion,
    cancelPromotion
  };
};
