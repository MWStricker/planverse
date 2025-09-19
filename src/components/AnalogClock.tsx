import { useState, useEffect } from 'react';
import { ClockSettings, type ClockSettings as ClockSettingsType } from './ClockSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const defaultSettings: ClockSettingsType = {
  format: '12h',
  style: 'digital',
  showSeconds: true,
  showDate: true,
  dateFormat: 'short',
  theme: 'auto'
};

export const AnalogClock = () => {
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

  // Load user's clock settings
  useEffect(() => {
    if (!user?.id) return;

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings_data')
        .eq('user_id', user.id)
        .eq('settings_type', 'clock')
        .single();

      if (data && !error && data.settings_data) {
        setSettings({ ...defaultSettings, ...(data.settings_data as unknown as ClockSettingsType) });
      }
    };

    loadSettings();
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
      case 'digital':
        return 'text-lg font-mono font-bold tracking-wider';
      case 'compact':
        return 'text-sm font-medium';
      case 'elegant':
        return 'text-base font-light tracking-wide italic';
      case 'minimal':
        return 'text-base font-normal';
      case 'bold':
        return 'text-xl font-black tracking-tight';
      default:
        return 'text-lg font-bold tracking-wide';
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
      case 'compact':
        return 'p-2';
      case 'bold':
        return 'p-4';
      default:
        return 'p-3';
    }
  };

  return (
    <>
      <div 
        className={`${getContainerClasses()} ${getSizeClasses()}`}
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
          console.log('Updating clock with new settings:', newSettings);
          setSettings(newSettings);
          // Force a re-render by updating the time to trigger style recalculation
          setTime(new Date());
        }}
      />
    </>
  );
};