import { supabase } from "@/integrations/supabase/client";

export const useModeration = () => {
  const moderateContent = async (
    content: string,
    contentType: 'post' | 'comment',
    contentId: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('moderate-content', {
        body: { content, contentType, contentId }
      });

      if (error) {
        console.error('Moderation error:', error);
        // Don't block post creation if moderation fails
        return { 
          score: 0, 
          flags: [], 
          reasoning: 'Moderation unavailable',
          status: 'approved' as const
        };
      }

      return data;
    } catch (error) {
      console.error('Moderation exception:', error);
      return { 
        score: 0, 
        flags: [], 
        reasoning: 'Moderation error',
        status: 'approved' as const
      };
    }
  };

  return { moderateContent };
};