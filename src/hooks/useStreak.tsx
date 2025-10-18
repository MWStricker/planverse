import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useStreak = () => {
  const { user } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchStreak();
  }, [user]);

  const fetchStreak = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('current_streak, last_activity_date')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Check if streak is still valid (last activity was yesterday or today)
        const lastActivity = data.last_activity_date ? new Date(data.last_activity_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (lastActivity) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          const lastActivityDate = new Date(lastActivity);
          lastActivityDate.setHours(0, 0, 0, 0);

          // If last activity was today or yesterday, streak is valid
          if (lastActivityDate >= yesterday) {
            setCurrentStreak(data.current_streak);
          } else {
            // Streak broken, reset it
            setCurrentStreak(0);
            await resetStreak();
          }
        } else {
          setCurrentStreak(data.current_streak);
        }
      } else {
        setCurrentStreak(0);
      }
    } catch (error) {
      console.error('Error fetching streak:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStreak = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const { data: existingStreak, error: fetchError } = await supabase
        .from('user_streaks')
        .select('current_streak, last_activity_date')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const todayDate = new Date(today);
      todayDate.setHours(0, 0, 0, 0);

      if (existingStreak) {
        const lastActivity = existingStreak.last_activity_date 
          ? new Date(existingStreak.last_activity_date) 
          : null;

        if (lastActivity) {
          const lastActivityDate = new Date(lastActivity);
          lastActivityDate.setHours(0, 0, 0, 0);

          // If already updated today, don't increment
          if (lastActivityDate.getTime() === todayDate.getTime()) {
            return;
          }

          // Check if it was yesterday
          const yesterday = new Date(todayDate);
          yesterday.setDate(yesterday.getDate() - 1);

          let newStreak: number;
          if (lastActivityDate.getTime() === yesterday.getTime()) {
            // Continue streak
            newStreak = existingStreak.current_streak + 1;
          } else {
            // Streak broken, start over
            newStreak = 1;
          }

          const { error: updateError } = await supabase
            .from('user_streaks')
            .update({
              current_streak: newStreak,
              last_activity_date: today,
            })
            .eq('user_id', user.id);

          if (updateError) throw updateError;
          setCurrentStreak(newStreak);
        } else {
          // First activity
          const { error: updateError } = await supabase
            .from('user_streaks')
            .update({
              current_streak: 1,
              last_activity_date: today,
            })
            .eq('user_id', user.id);

          if (updateError) throw updateError;
          setCurrentStreak(1);
        }
      } else {
        // Create new streak record
        const { error: insertError } = await supabase
          .from('user_streaks')
          .insert({
            user_id: user.id,
            current_streak: 1,
            last_activity_date: today,
          });

        if (insertError) throw insertError;
        setCurrentStreak(1);
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  };

  const resetStreak = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_streaks')
        .update({ current_streak: 0 })
        .eq('user_id', user.id);

      if (error) throw error;
      setCurrentStreak(0);
    } catch (error) {
      console.error('Error resetting streak:', error);
    }
  };

  return {
    currentStreak,
    loading,
    updateStreak,
  };
};
