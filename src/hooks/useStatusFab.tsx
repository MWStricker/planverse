import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type PositionCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface StatusFabSettings {
  online: boolean;
  position: PositionCorner;
  offset: number;
}

const defaultSettings: StatusFabSettings = {
  online: true,
  position: 'br',
  offset: 16,
};

export const useStatusFab = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StatusFabSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial settings
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings_latest')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'status')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading status FAB settings:', error);
        }

        if (data?.settings_data && typeof data.settings_data === 'object' && !Array.isArray(data.settings_data)) {
          const settingsObj = data.settings_data as Record<string, any>;
          setSettings({
            online: !!settingsObj.online,
            position: (settingsObj.position as PositionCorner) || 'br',
            offset: Number(settingsObj.offset) || 16,
          });
        }
      } catch (error) {
        console.error('Failed to load status FAB settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('status_fab_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = (payload.new as any)?.settings_data;
          if (newData && (payload.new as any)?.settings_type === 'status') {
            setSettings({
              online: !!newData.online,
              position: (newData.position as PositionCorner) || 'br',
              offset: Number(newData.offset) || 16,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateStatus = async (
    online?: boolean,
    position?: PositionCorner,
    offset?: number
  ) => {
    if (!user) return false;

    const newSettings = {
      online: online ?? settings.online,
      position: position ?? settings.position,
      offset: offset ?? settings.offset,
    };

    // Optimistic update
    setSettings(newSettings);

    try {
      const { error } = await supabase.rpc('set_my_status', {
        p_online: newSettings.online,
        p_position: newSettings.position,
        p_offset: newSettings.offset,
      });

      if (error) {
        console.error('Error updating status:', error);
        // Revert on error
        setSettings(settings);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to update status:', error);
      setSettings(settings);
      return false;
    }
  };

  return {
    settings,
    isLoading,
    updateStatus,
  };
};
