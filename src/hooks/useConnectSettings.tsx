import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface ConnectSettings {
  privacy: {
    allowMessagesFromNonFriends: boolean;
    showOnlineStatus: boolean;
    defaultPostVisibility: 'public' | 'friends-only' | 'school-only' | 'major-only';
  };
  notifications: {
    notifyOnComments: boolean;
    notifyOnLikes: boolean;
    notifyOnMentions: boolean;
  };
  contentFilters: {
    hidePostsWithoutImages: boolean;
    showPromotedPosts: boolean;
    hideMajors: string[];
    hideSchools: string[];
  };
}

const defaultSettings: ConnectSettings = {
  privacy: {
    allowMessagesFromNonFriends: true,
    showOnlineStatus: true,
    defaultPostVisibility: 'public',
  },
  notifications: {
    notifyOnComments: true,
    notifyOnLikes: true,
    notifyOnMentions: true,
  },
  contentFilters: {
    hidePostsWithoutImages: false,
    showPromotedPosts: true,
    hideMajors: [],
    hideSchools: [],
  },
};

export const useConnectSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<ConnectSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings_data')
        .eq('user_id', user.id)
        .eq('settings_type', 'connect')
        .maybeSingle();

      if (error) throw error;

      if (data && data.settings_data) {
        setSettings({ ...defaultSettings, ...(data.settings_data as any) });
      }
    } catch (error) {
      console.error('Error fetching Connect settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<ConnectSettings>): Promise<boolean> => {
    if (!user) return false;

    const updatedSettings = {
      ...settings,
      ...newSettings,
    };

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings_type: 'connect',
          settings_data: updatedSettings,
        }, {
          onConflict: 'user_id,settings_type',
        });

      if (error) throw error;

      setSettings(updatedSettings);
      toast({
        title: "Settings updated",
        description: "Your Connect settings have been saved.",
      });

      return true;
    } catch (error) {
      console.error('Error updating Connect settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
  };
};
