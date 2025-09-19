import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  style: 'digital' | 'compact' | 'elegant' | 'minimal' | 'bold';
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
    value: 'digital', 
    label: 'Digital', 
    description: 'Classic digital display with seconds',
    preview: 'Large, clear numbers'
  },
  { 
    value: 'compact', 
    label: 'Compact', 
    description: 'Space-saving minimal design',
    preview: 'Small, efficient'
  },
  { 
    value: 'elegant', 
    label: 'Elegant', 
    description: 'Stylish with decorative elements',
    preview: 'Beautiful, refined'
  },
  { 
    value: 'minimal', 
    label: 'Minimal', 
    description: 'Clean and simple',
    preview: 'Just the essentials'
  },
  { 
    value: 'bold', 
    label: 'Bold', 
    description: 'High contrast and prominent',
    preview: 'Eye-catching display'
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

  // Auto-save functionality (database only, no parent updates)
  useEffect(() => {
    if (!user?.id || JSON.stringify(settings) === JSON.stringify(currentSettings)) return;

    const autoSave = async () => {
      try {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            settings_type: 'clock',
            settings_data: settings as any,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Auto-save error:', error);
        }
      } catch (error) {
        console.error('Auto-save error:', error);
      }
    };

    const debounceTimer = setTimeout(autoSave, 500);
    return () => clearTimeout(debounceTimer);
  }, [settings, user?.id]);

  // Create preview of current settings
  const getPreviewTime = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      hour12: settings.format === '12h',
      hour: '2-digit',
      minute: '2-digit',
      ...(settings.showSeconds && { second: '2-digit' })
    };
    return now.toLocaleTimeString('en-US', options);
  };

  const getPreviewDate = () => {
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
  };

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

  const getStyleClasses = (style: string) => {
    switch (style) {
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
        return 'text-base font-medium';
    }
  };

  const getThemeClasses = (theme: string) => {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-smooth" style={{ scrollBehavior: 'smooth' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Clock Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 transform-gpu" style={{ backfaceVisibility: 'hidden' }}>
          {/* Preview Section */}
          <Card className="transition-all duration-200">
            <CardContent className="pt-4">
              <div className="text-center space-y-2">
                <Label className="text-sm font-medium">Live Preview</Label>
                <div className={`mx-auto w-fit p-4 rounded-lg border transition-all duration-300 ${getThemeClasses(settings.theme)}`}>
                  <div className={`${getStyleClasses(settings.style)} mb-1 transition-all duration-200`}>
                    {getPreviewTime()}
                  </div>
                  {settings.showDate && (
                    <div className="text-xs opacity-70 transition-all duration-200">
                      {getPreviewDate()}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 transform-gpu">
              {clockStyles.map((style) => (
                <Card 
                  key={style.value}
                  className={`cursor-pointer transition-all duration-200 hover-scale ${
                    settings.style === style.value 
                      ? 'ring-2 ring-primary bg-primary/5 animate-scale-in' 
                      : 'hover:bg-muted/50 hover:shadow-md'
                  }`}
                  onClick={() => {
                    const newSettings = { ...settings, style: style.value as any };
                    setSettings(newSettings);
                    // Update parent immediately for live display
                    onSettingsChange(newSettings);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{style.label}</h4>
                      {settings.style === style.value && (
                        <Badge variant="default" className="text-xs animate-fade-in">Applied</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{style.description}</p>
                    <div className={`text-xs p-2 bg-muted/30 rounded transition-all duration-200 ${getStyleClasses(style.value)}`}>
                      {style.preview}
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
      </DialogContent>
    </Dialog>
  );
};