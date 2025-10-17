import { useState, useEffect } from 'react';
import { ClockSettings, type ClockSettings as ClockSettingsType } from './ClockSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const defaultSettings: ClockSettingsType = {
  format: '12h',
  style: 'system',
  showSeconds: true,
  showDate: true,
  dateFormat: 'short',
  theme: 'auto'
};

export const AnalogClock = ({ className }: { className?: string }) => {
  const [time, setTime] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ClockSettingsType>(defaultSettings);
  const { user } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Safely load user's clock settings without affecting other data
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'clock') // Only load clock settings
          .single();

        if (isMounted && data && !error && data.settings_data) {
          // Safely merge with defaults to prevent data corruption
          const loadedSettings = { ...defaultSettings, ...(data.settings_data as unknown as ClockSettingsType) };
          setSettings(loadedSettings);
        }
      } catch (error) {
        console.error('Error loading clock settings:', error);
        // Fallback to defaults on error to prevent data loss
        if (isMounted) {
          setSettings(defaultSettings);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const formatTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour12: settings.format === '12h',
      hour: '2-digit',
      minute: '2-digit',
      ...(settings.showSeconds && { second: '2-digit' })
    };
    return date.toLocaleTimeString('en-US', options);
  };

  const formatDate = (date: Date) => {
    switch (settings.dateFormat) {
      case 'short':
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
      case 'long':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      case 'numeric':
        return date.toLocaleDateString('en-US');
      default:
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
    }
  };

  const getStyleClasses = () => {
    switch (settings.style) {
      case 'system':
        return 'text-xl font-system font-semibold tracking-normal';
      case 'readable':
        return 'text-xl font-lexend font-medium tracking-normal';
      case 'monospace':
        return 'text-xl font-jetbrains font-medium tracking-wider';
      case 'geometric':
        return 'text-xl font-poppins font-medium tracking-normal';
      case 'condensed':
        return 'text-xl font-oswald font-semibold tracking-wide uppercase';
      default:
        return 'text-xl font-system font-medium tracking-normal';
    }
  };

  const getContainerClasses = () => {
    const baseClasses = "flex flex-col items-center p-3 border rounded-lg backdrop-blur-sm cursor-pointer transition-all hover:scale-105 hover:shadow-md";
    
    switch (settings.theme) {
      case 'light':
        return `${baseClasses} bg-white text-black border-gray-200`;
      case 'dark':
        return `${baseClasses} bg-gray-900 text-white border-gray-700`;
      case 'accent':
        return `${baseClasses} bg-primary text-primary-foreground border-primary`;
      default:
        return `${baseClasses} bg-card/50 border-border text-foreground`;
    }
  };

  const getSizeClasses = () => {
    switch (settings.style) {
      case 'monospace':
        return 'p-4'; // Monospace needs more space for readability
      case 'readable':
        return 'p-4'; // Lexend benefits from more breathing room
      default:
        return 'p-3';
    }
  };

  return (
    <>
      <div 
        className={`${getContainerClasses()} ${getSizeClasses()} ${className || ''}`}
        onClick={() => setIsSettingsOpen(true)}
        title="Click to customize clock"
      >
        <div className="text-center">
          <div className={`${getStyleClasses()} mb-1`}>
            {formatTime(time)}
          </div>
          {settings.showDate && (
            <div className="text-xs opacity-70">
              {formatDate(time)}
            </div>
          )}
        </div>
      </div>

      <ClockSettings
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        currentSettings={settings}
        onSettingsChange={(newSettings) => {
          setSettings(newSettings);
        }}
      />
    </>
  );
};