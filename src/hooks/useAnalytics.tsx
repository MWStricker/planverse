import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type TimeRange = '24h' | '7d' | '30d' | 'all';

export interface AnalyticsSummary {
  totalPosts: number;
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number;
  activePromotions: number;
}

export interface PostAnalytics {
  postId: string;
  postContent: string;
  postImageUrl: string | null;
  postCreatedAt: string;
  isPromoted: boolean;
  totalImpressions: number;
  totalClicks: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
}

export interface TimeSeriesData {
  date: string;
  impressions: number;
  engagement: number;
  clicks: number;
}

export const useAnalytics = (timeRange: TimeRange = '30d') => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [postAnalytics, setPostAnalytics] = useState<PostAnalytics[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(false);
  
  const getInterval = () => {
    switch (timeRange) {
      case '24h': return '1 day';
      case '7d': return '7 days';
      case '30d': return '30 days';
      case 'all': return '10 years';
    }
  };
  
  const getDays = () => {
    switch (timeRange) {
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case 'all': return 365;
    }
  };
  
  const fetchAnalyticsSummary = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_post_analytics_summary', {
        p_user_id: user.id,
        p_time_range: getInterval()
      });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setSummary({
          totalPosts: data[0].total_posts || 0,
          totalImpressions: Number(data[0].total_impressions) || 0,
          totalEngagement: Number(data[0].total_engagement) || 0,
          avgEngagementRate: Number(data[0].avg_engagement_rate) || 0,
          activePromotions: data[0].active_promotions || 0
        });
      }
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPostAnalytics = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.rpc('get_individual_post_analytics', {
        p_user_id: user.id,
        p_limit: 50
      });
      
      if (error) throw error;
      if (data) {
        const formattedData = data.map((item: any) => ({
          postId: item.post_id,
          postContent: item.post_content,
          postImageUrl: item.post_image_url,
          postCreatedAt: item.post_created_at,
          isPromoted: item.is_promoted,
          totalImpressions: Number(item.total_impressions) || 0,
          totalClicks: Number(item.total_clicks) || 0,
          totalLikes: Number(item.total_likes) || 0,
          totalComments: Number(item.total_comments) || 0,
          totalShares: Number(item.total_shares) || 0,
          engagementRate: Number(item.engagement_rate) || 0
        }));
        setPostAnalytics(formattedData);
      }
    } catch (error) {
      console.error('Error fetching post analytics:', error);
    }
  };
  
  const fetchTimeSeriesData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.rpc('get_analytics_timeseries', {
        p_user_id: user.id,
        p_days: getDays()
      });
      
      if (error) throw error;
      if (data) {
        const formattedData = data.map((item: any) => ({
          date: item.date,
          impressions: Number(item.impressions) || 0,
          engagement: Number(item.engagement) || 0,
          clicks: Number(item.clicks) || 0
        }));
        setTimeSeriesData(formattedData);
      }
    } catch (error) {
      console.error('Error fetching time series data:', error);
    }
  };
  
  useEffect(() => {
    if (!user) return;
    
    fetchAnalyticsSummary();
    fetchPostAnalytics();
    fetchTimeSeriesData();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('analytics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_analytics',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('Analytics updated - refreshing data');
          fetchAnalyticsSummary();
          fetchPostAnalytics();
          fetchTimeSeriesData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promoted_posts',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('Promoted posts updated - refreshing summary');
          fetchAnalyticsSummary();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, timeRange]);
  
  return {
    summary,
    postAnalytics,
    timeSeriesData,
    loading,
    refetch: () => {
      fetchAnalyticsSummary();
      fetchPostAnalytics();
      fetchTimeSeriesData();
    }
  };
};
