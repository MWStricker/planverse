import { supabase } from '@/integrations/supabase/client';

export interface MatchedUser {
  user_id: string;
  match_score: number;
  display_name: string;
  avatar_url?: string;
  school?: string;
  major?: string;
  shared_interests: {
    music?: string;
    year?: string;
    clubs?: string[];
  };
}

export const fetchSuggestedMatches = async (limit: number = 20): Promise<MatchedUser[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user');
      return [];
    }

    const { data, error } = await supabase.rpc('get_suggested_matches', {
      target_user_id: user.id,
      match_limit: limit
    });
    
    if (error) {
      console.error('Error fetching matches:', error);
      return [];
    }
    
    return (data || []) as MatchedUser[];
  } catch (error) {
    console.error('Error in fetchSuggestedMatches:', error);
    return [];
  }
};

export const getMatchScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-muted-foreground';
};

export const getMatchScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'bg-blue-100 dark:bg-blue-900/30';
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-muted';
};

export const getMatchScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent Match';
  if (score >= 60) return 'Great Match';
  if (score >= 40) return 'Good Match';
  return 'Potential Match';
};
