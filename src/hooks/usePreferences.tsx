import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserPreferences {
  theme: 'default' | 'dark' | 'warm' | 'ocean' | 'forest' | 'sunset';
  boldText: boolean;
  textSize: 'small' | 'medium' | 'large';
}

const defaultPreferences: UserPreferences = {
  theme: 'default',
  boldText: false,
  textSize: 'medium',
};

export const usePreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const { user } = useAuth();

  // Load preferences from database or localStorage
  useEffect(() => {
    console.log('Loading preferences for user:', user?.id);
    const loadPreferences = async () => {
      if (user) {
        // Load from database for authenticated users
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('settings_data')
            .eq('user_id', user.id)
            .eq('settings_type', 'preferences')
            .maybeSingle();

          if (error && error.code !== 'PGRST116') { // Not a "no rows" error
            console.error('Error loading preferences from database:', error);
            // Fallback to localStorage
            loadFromLocalStorage();
            return;
          }

          if (data?.settings_data) {
            console.log('Loaded preferences from database:', data.settings_data);
            const loadedPrefs = { ...defaultPreferences, ...(data.settings_data as unknown as UserPreferences) };
            setPreferences(loadedPrefs);
            applyPreferences(loadedPrefs);
            // Also sync to localStorage for faster loading
            localStorage.setItem('userPreferences', JSON.stringify(loadedPrefs));
          } else {
            console.log('No preferences found in database, checking localStorage');
            // No preferences in database, check localStorage and migrate to database
            const stored = localStorage.getItem('userPreferences');
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                const loadedPrefs = { ...defaultPreferences, ...parsed };
                setPreferences(loadedPrefs);
                applyPreferences(loadedPrefs);
                
                // Migrate localStorage preferences to database
                await supabase
                  .from('user_settings')
                  .insert({
                    user_id: user.id,
                    settings_type: 'preferences',
                    settings_data: loadedPrefs as any,
                  });
              } catch (error) {
                console.error('Failed to migrate preferences to database:', error);
              }
            } else {
              // No preferences anywhere, use defaults and save to database
              setPreferences(defaultPreferences);
              applyPreferences(defaultPreferences);
              await supabase
                .from('user_settings')
                .insert({
                  user_id: user.id,
                  settings_type: 'preferences',
                  settings_data: defaultPreferences as any,
                });
            }
          }
        } catch (error) {
          console.error('Failed to load preferences from database:', error);
          loadFromLocalStorage();
        }
      } else {
        // Load from localStorage for non-authenticated users
        loadFromLocalStorage();
      }
    };

    const loadFromLocalStorage = () => {
      const saved = localStorage.getItem('userPreferences');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const loadedPrefs = { ...defaultPreferences, ...parsed };
          setPreferences(loadedPrefs);
          applyPreferences(loadedPrefs);
        } catch (error) {
          console.error('Failed to parse saved preferences:', error);
          setPreferences(defaultPreferences);
          applyPreferences(defaultPreferences);
        }
      } else {
        setPreferences(defaultPreferences);
        applyPreferences(defaultPreferences);
      }
    };

    loadPreferences();
  }, [user]);

  // Set up real-time syncing for authenticated users
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-preferences')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).settings_type === 'preferences') {
            const newPrefs = { ...defaultPreferences, ...(payload.new as any).settings_data };
            setPreferences(newPrefs);
            applyPreferences(newPrefs);
            // Also update localStorage for consistency
            localStorage.setItem('userPreferences', JSON.stringify(newPrefs));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const applyPreferences = (prefs: UserPreferences) => {
    const root = document.documentElement;
    
    // Apply theme
    root.setAttribute('data-theme', prefs.theme);
    
    // Special handling for dark theme
    if (prefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Apply bold text
    if (prefs.boldText) {
      root.style.setProperty('--font-weight-normal', '600');
      root.style.setProperty('--font-weight-medium', '700');
      root.style.setProperty('--font-weight-semibold', '800');
      root.style.setProperty('--font-weight-bold', '900');
    } else {
      root.style.removeProperty('--font-weight-normal');
      root.style.removeProperty('--font-weight-medium');
      root.style.removeProperty('--font-weight-semibold');
      root.style.removeProperty('--font-weight-bold');
    }
    
    // Apply text size
    const sizeMap = {
      small: '0.875rem',
      medium: '1rem',
      large: '1.125rem'
    };
    root.style.setProperty('--base-font-size', sizeMap[prefs.textSize]);
  };

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    console.log('Updating preference:', key, 'to:', value);
    const newPrefs = { ...preferences, [key]: value };
    console.log('New preferences object:', newPrefs);
    setPreferences(newPrefs);
    applyPreferences(newPrefs);

    // Save to localStorage immediately for instant persistence
    localStorage.setItem('userPreferences', JSON.stringify(newPrefs));

    // Save to database for authenticated users with retry logic
    if (user) {
      let retryCount = 0;
      const maxRetries = 3;
      
      const saveToDatabase = async (): Promise<void> => {
        try {
          const { error } = await supabase
            .from('user_settings')
            .upsert({
              user_id: user.id,
              settings_type: 'preferences',
              settings_data: newPrefs as any,
            });

          if (error) {
            throw error;
          }
        } catch (error) {
          console.error(`Error saving preferences to database (attempt ${retryCount + 1}):`, error);
          
          if (retryCount < maxRetries) {
            retryCount++;
            // Exponential backoff: wait 1s, then 2s, then 4s
            const delay = Math.pow(2, retryCount - 1) * 1000;
            setTimeout(() => saveToDatabase(), delay);
          } else {
            console.error('Failed to save preferences after maximum retries');
            // Preferences are still saved in localStorage, so functionality continues
          }
        }
      };

      await saveToDatabase();
    }
  };

  return {
    preferences,
    updatePreference,
  };
};