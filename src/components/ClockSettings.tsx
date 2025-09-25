import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Settings, 
  Palette, 
  Eye,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ClockSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: ClockSettings;
  onSettingsChange: (settings: ClockSettings) => void;
}

export interface ClockSettings {
  format: '12h' | '24h';
  style: 'system' | 'modern' | 'monospace' | 'accessible' | 'traditional';
  showSeconds: boolean;
  showDate: boolean;
  dateFormat: 'short' | 'long' | 'numeric';
  theme: 'auto' | 'light' | 'dark' | 'accent';
}

const timeFormats = [
  { value: '12h', label: '12-Hour (2:30 PM)' },
  { value: '24h', label: '24-Hour (14:30)' }
];

const clockStyles = [
  { 
    value: 'system', 
    label: 'System Default', 
    description: 'Uses your device\'s native font (SF Pro, Segoe UI, Roboto)',
    preview: 'Familiar, native feel',
    font: 'System UI'
  },
  { 
    value: 'modern', 
    label: 'Modern Sans', 
    description: 'Clean Inter font - popular in modern apps and websites',
    preview: 'Contemporary, readable',
    font: 'Inter'
  },
  { 
    value: 'monospace', 
    label: 'Monospace Classic', 
    description: 'Fixed-width Roboto Mono - perfect for precise time display',
    preview: 'Precise, digital feel',
    font: 'Roboto Mono'
  },
  { 
    value: 'accessible', 
    label: 'High Readability', 
    description: 'Lexend font designed for improved reading proficiency',
    preview: 'Easy to read quickly',
    font: 'Lexend'
  },
  { 
    value: 'traditional', 
    label: 'Traditional', 
    description: 'Open Sans - widely used, comfortable for extended viewing',
    preview: 'Classic, professional',
    font: 'Open Sans'
  }
];

const dateFormats = [
  { value: 'short', label: 'Short (Dec 25)' },
  { value: 'long', label: 'Long (December 25, 2024)' },
  { value: 'numeric', label: 'Numeric (12/25/2024)' }
];

const themes = [
  { value: 'auto', label: 'Auto (Follow System)' },
  { value: 'light', label: 'Light Theme' },
  { value: 'dark', label: 'Dark Theme' },
  { value: 'accent', label: 'Accent Color' }
];

export const ClockSettings = ({ open, onOpenChange, currentSettings, onSettingsChange }: ClockSettingsProps) => {
  const [settings, setSettings] = useState<ClockSettings>(currentSettings);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Sync local settings with prop changes
  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  // Auto-save to database when settings change (debounced for performance)
  useEffect(() => {
    if (!user?.id || !settings) return;
    
    // Only auto-save if settings are different from current
    const settingsChanged = JSON.stringify(settings) !== JSON.stringify(currentSettings);
    if (!settingsChanged) return;

    const autoSave = async () => {
      try {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            settings_type: 'clock',
            settings_data: settings as any,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,settings_type',
            ignoreDuplicates: false
          });

        if (error) {
          console.error('Clock auto-save error:', error);
        }
      } catch (error) {
        console.error('Clock auto-save error:', error);
      }
    };

    // Increased debounce to reduce scroll performance impact
    const debounceTimer = setTimeout(autoSave, 1000);
    return () => clearTimeout(debounceTimer);
  }, [settings.format, settings.showSeconds, settings.showDate, settings.dateFormat, settings.theme, user?.id]);

  // Memoized preview functions for performance
  const previewTime = useMemo(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      hour12: settings.format === '12h',
      hour: '2-digit',
      minute: '2-digit',
      ...(settings.showSeconds && { second: '2-digit' })
    };
    return now.toLocaleTimeString('en-US', options);
  }, [settings.format, settings.showSeconds]);

  const previewDate = useMemo(() => {
    const now = new Date();
    switch (settings.dateFormat) {
      case 'short':
        return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'long':
        return now.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'numeric':
        return now.toLocaleDateString('en-US');
      default:
        return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }, [settings.dateFormat]);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings_type: 'clock',
          settings_data: settings as any,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      onSettingsChange(settings);
      toast({
        title: "Clock settings saved",
        description: "Your clock preferences have been updated.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving clock settings:', error);
      toast({
        title: "Error",
        description: "Failed to save clock settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized style classes for performance
  const getStyleClasses = useCallback((style: string) => {
    switch (style) {
      case 'system':
        return 'text-lg font-system font-semibold tracking-normal';
      case 'modern':
        return 'text-lg font-inter font-medium tracking-tight';
      case 'monospace':
        return 'text-lg font-roboto-mono font-medium tracking-wider';
      case 'accessible':
        return 'text-lg font-lexend font-medium tracking-normal';
      case 'traditional':
        return 'text-lg font-open-sans font-semibold tracking-normal';
      default:
        return 'text-lg font-system font-medium tracking-normal';
    }
  }, []);

  const getThemeClasses = useCallback((theme: string) => {
    switch (theme) {
      case 'light':
        return 'bg-white text-black border-gray-200';
      case 'dark':
        return 'bg-gray-900 text-white border-gray-700';
      case 'accent':
        return 'bg-primary text-primary-foreground border-primary';
      default:
        return 'bg-card text-foreground border-border';
    }
  }, []);

  // Optimized style change handler
  const handleStyleChange = useCallback(async (styleValue: string) => {
    const newSettings = { ...settings, style: styleValue as any };
    setSettings(newSettings);
    
    // Immediately save style changes to database
    if (user?.id) {
      try {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            settings_type: 'clock',
            settings_data: newSettings as any,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,settings_type',
            ignoreDuplicates: false
          });
      } catch (error) {
        console.error('Error saving style:', error);
      }
    }
    
    // Update parent for live display
    onSettingsChange(newSettings);
  }, [settings, user?.id, onSettingsChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden" style={{ contain: 'layout' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Clock Settings
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]" style={{ overscrollBehavior: 'contain' }}>
          <div className="space-y-6 pr-4" style={{ contain: 'layout style paint' }}>
          {/* Preview Section */}
          <Card className="transition-transform duration-200">
            <CardContent className="pt-4">
              <div className="text-center space-y-2">
                <Label className="text-sm font-medium">Live Preview</Label>
                <div className={`mx-auto w-fit p-4 rounded-lg border transition-colors duration-200 ${getThemeClasses(settings.theme)}`}>
                  <div className={`${getStyleClasses(settings.style)} mb-1`}>
                    {previewTime}
                  </div>
                  {settings.showDate && (
                    <div className="text-xs opacity-70">
                      {previewDate}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Format */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Time Format
            </Label>
            <Select
              value={settings.format}
              onValueChange={(value: '12h' | '24h') => setSettings({ ...settings, format: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeFormats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clock Style */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Clock Style
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clockStyles.map((style) => (
                <Card 
                  key={style.value}
                  className={`cursor-pointer transition-colors duration-200 hover:bg-muted/50 ${
                    settings.style === style.value 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:shadow-sm'
                  }`}
                  style={{ contain: 'layout style paint', willChange: 'auto' }}
                  onClick={() => handleStyleChange(style.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{style.label}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{style.font}</p>
                      </div>
                      {settings.style === style.value && (
                        <Badge variant="default" className="text-xs">Applied</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{style.description}</p>
                    <div className={`text-sm p-3 bg-muted/30 rounded ${getStyleClasses(style.value)} text-center`}>
                      {previewTime} 
                      {settings.showDate && <div className="text-xs opacity-70 mt-1">{previewDate}</div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          {/* Display Options */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Display Options
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-seconds">Show Seconds</Label>
                  <p className="text-sm text-muted-foreground">Display seconds in time</p>
                </div>
                <Switch
                  id="show-seconds"
                  checked={settings.showSeconds}
                  onCheckedChange={(checked) => setSettings({ ...settings, showSeconds: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-date">Show Date</Label>
                  <p className="text-sm text-muted-foreground">Display current date</p>
                </div>
                <Switch
                  id="show-date"
                  checked={settings.showDate}
                  onCheckedChange={(checked) => setSettings({ ...settings, showDate: checked })}
                />
              </div>
            </div>

            {settings.showDate && (
              <div>
                <Label className="text-sm font-medium">Date Format</Label>
                <Select
                  value={settings.dateFormat}
                  onValueChange={(value: 'short' | 'long' | 'numeric') => 
                    setSettings({ ...settings, dateFormat: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFormats.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Theme */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(value: 'auto' | 'light' | 'dark' | 'accent') => 
                setSettings({ ...settings, theme: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-save indicator */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Auto-saving enabled
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};