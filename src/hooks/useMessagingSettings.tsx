import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MessagingSettings {
  read_receipts_enabled: boolean;
  typing_indicators_enabled: boolean;
}

const defaultSettings: MessagingSettings = {
  read_receipts_enabled: true,
  typing_indicators_enabled: true,
};

export const useMessagingSettings = () => {
  const [settings, setSettings] = useState<MessagingSettings>(defaultSettings);
  const { user } = useAuth();

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'messaging')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading messaging settings:', error);
          return;
        }

        if (data?.settings_data) {
          setSettings({ ...defaultSettings, ...(data.settings_data as unknown as MessagingSettings) });
        }
      } catch (error) {
        console.error('Failed to load messaging settings:', error);
      }
    };

    loadSettings();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-messaging-settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).settings_type === 'messaging') {
            setSettings({ ...defaultSettings, ...(payload.new as any).settings_data });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateSetting = async <K extends keyof MessagingSettings>(
    key: K,
    value: MessagingSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    if (user) {
      try {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            settings_type: 'messaging',
            settings_data: newSettings,
          });
      } catch (error) {
        console.error('Error saving messaging setting:', error);
      }
    }
  };

  return {
    settings,
    updateSetting,
  };
};
