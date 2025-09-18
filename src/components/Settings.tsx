import { useState, useRef, useEffect } from "react";
import { Settings as SettingsIcon, Link, CheckCircle, AlertCircle, ExternalLink, Shield, Bell, User, Palette, LogOut, Monitor, Type, Zap, Camera, Upload, Save, GraduationCap, Clock, Target, Calendar, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { usePreferences } from "@/hooks/usePreferences";
import { useProfile } from "@/hooks/useProfile";
import { useProfileEditing } from "@/hooks/useProfileEditing";
import { universities, getUniversityById, getPublicUniversities, searchPublicUniversities } from "@/data/universities";
import { collegeMajors } from "@/data/collegeMajors";
import { supabase } from "@/integrations/supabase/client";
import { courseIcons, getCourseIconCategories } from "@/data/courseIcons";

interface AccountIntegration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  connectedEmail?: string;
  lastSync?: string;
  features: string[];
  category: 'academic' | 'calendar' | 'communication';
}

const accountIntegrations: AccountIntegration[] = [
  {
    id: 'canvas',
    name: 'Canvas LMS',
    description: 'Your school\'s learning management system',
    icon: '🎓',
    status: 'disconnected',
    features: ['Assignments', 'Grades', 'Course schedules', 'Announcements'],
    category: 'academic',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync with your Google Calendar',
    icon: '📅',
    status: 'disconnected',
    features: ['Event sync', 'Create study blocks', 'Free time detection'],
    category: 'calendar',
  },
  {
    id: 'outlook',
    name: 'Outlook Calendar',
    description: 'Microsoft Outlook calendar integration',
    icon: '📧',
    status: 'disconnected',
    features: ['Email calendar', 'Meeting sync', 'Office 365 integration'],
    category: 'calendar',
  },
  {
    id: 'apple-calendar',
    name: 'Apple Calendar',
    description: 'iCloud calendar synchronization',
    icon: '🍎',
    status: 'disconnected',
    features: ['iCloud sync', 'Cross-device events', 'CalDAV support'],
    category: 'calendar',
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Class meetings and collaboration',
    icon: '👥',
    status: 'disconnected',
    features: ['Meeting notifications', 'Class links', 'Team assignments'],
    category: 'communication',
  },
];

export const Settings = ({ defaultTab = 'accounts' }: { defaultTab?: string } = {}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [notifications, setNotifications] = useState({
    assignments: true,
    deadlines: true,
    studyReminders: true,
    syncErrors: false,
  });
  const { signOut, user } = useAuth();
  const { toast } = useToast();

  // Fetch tasks and events for calculating assignment time
  const { data: userTasks = [] } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: userEvents = [] } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
  const { preferences, updatePreference } = usePreferences();
  const { profile, loading: profileLoading, uploading, updateProfile, uploadAvatar } = useProfile();
  const { updateLiveProfile } = useProfileEditing();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local state for profile editing
  const [editedProfile, setEditedProfile] = useState({
    display_name: '',
    school: '',
    major: '',
    campus_location: '',
    bio: '',
    graduation_year: '',
    is_public: true,
    timezone: 'America/New_York'
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [majorError, setMajorError] = useState('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [courseIcons_State, setCourseIcons_State] = useState<Record<string, string>>({});
  const [courses, setCourses] = useState<Array<{code: string, icon?: string}>>([]);
  const [customPrimaryColor, setCustomPrimaryColor] = useState('#3b82f6');
  const [customSecondaryColor, setCustomSecondaryColor] = useState('#8b5cf6');
  const [isChangingColor, setIsChangingColor] = useState(false);
  
  // Get all public universities sorted alphabetically by name
  const getAllPublicUniversities = () => {
    return universities
      .filter(university => university.isPublic)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Load and sync notification settings with database
  useEffect(() => {
    const loadNotifications = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('settings_data')
            .eq('user_id', user.id)
            .eq('settings_type', 'notifications')
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            console.error('Error loading notifications from database:', error);
            return;
          }

          if (data?.settings_data) {
            setNotifications(prev => ({ ...prev, ...(data.settings_data as any) }));
          }
        } catch (error) {
          console.error('Failed to load notifications from database:', error);
        }
      }
    };

    loadNotifications();
  }, [user]);

  // Set up real-time syncing for notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).settings_type === 'notifications') {
            setNotifications(prev => ({ ...prev, ...(payload.new as any).settings_data }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load custom colors from preferences
  useEffect(() => {
    if (preferences.customPrimaryColor) {
      setCustomPrimaryColor(preferences.customPrimaryColor);
    }
    if (preferences.customSecondaryColor) {
      setCustomSecondaryColor(preferences.customSecondaryColor);
    }
  }, [preferences.customPrimaryColor, preferences.customSecondaryColor]);

  // Load course icons and courses
  useEffect(() => {
    const loadCourseData = async () => {
      if (!user) return;

      try {
        // Load saved course icons
        const { data: iconData } = await supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'course_icons')
          .maybeSingle();

        if (iconData?.settings_data) {
          setCourseIcons_State(iconData.settings_data as Record<string, string>);
        }

        // Load courses from events
        const { data: events } = await supabase
          .from('events')
          .select('title')
          .eq('user_id', user.id)
          .eq('source_provider', 'canvas');

        const uniqueCourses = new Set<string>();
        events?.forEach(event => {
          const courseCode = extractCourseCodeFromTitle(event.title);
          if (courseCode) {
            uniqueCourses.add(courseCode);
          }
        });

        setCourses(Array.from(uniqueCourses).map(code => ({ code })));
      } catch (error) {
        console.error('Error loading course data:', error);
      }
    };

    loadCourseData();
  }, [user]);

  // Helper function to extract course code
  const extractCourseCodeFromTitle = (title: string) => {
    const patterns = [
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)\]/i,
      /\[([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)-(\d{4}[A-Z]{2})\]/i,
      /\b([A-Z]{2,4}-?\d{3,4}[A-Z]?)\b/i,
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        let courseCode = match[2] || match[1];
        courseCode = courseCode.replace(/\d{4}[A-Z]{2}/, '').replace(/^-|-$/, '');
        return courseCode.toUpperCase();
      }
    }
    return null;
  };

  // Update course icon
  const updateCourseIcon = async (courseCode: string, iconId: string) => {
    const newIcons = { ...courseIcons_State, [courseCode]: iconId };
    setCourseIcons_State(newIcons);

    if (user) {
      try {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            settings_type: 'course_icons',
            settings_data: newIcons,
          });

        toast({
          title: "Icon updated",
          description: `Course icon for ${courseCode} has been saved.`,
        });
      } catch (error) {
        console.error('Error saving course icon:', error);
      }
    }
  };

  // Convert hex to HSL
  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  };

  const handleApplyCustomColor = async (colorType: 'primary' | 'secondary') => {
    // Automatically switch to custom theme when applying custom colors
    if (preferences.theme !== 'custom') {
      await updatePreference('theme', 'custom');
    }
    
    setIsChangingColor(true);
    try {
      const color = colorType === 'primary' ? customPrimaryColor : customSecondaryColor;
      const [h, s, l] = hexToHsl(color);
      const hslString = `${h} ${s}% ${l}%`;
      
      // Apply the color to CSS variables
      const root = document.documentElement;
      
      if (colorType === 'primary') {
        // Primary color changes background and main theme colors with proper contrast
        const bgLightness = Math.min(Math.max(l + 35, 92), 98); // Ensure light enough background
        const cardLightness = Math.min(Math.max(l + 30, 88), 95); // Slightly darker than background
        const mutedLightness = Math.min(Math.max(l + 25, 85), 92); // Even slightly darker
        
        // Helper function for contrasting text
        const getContrastingText = (backgroundL: number) => {
          return backgroundL > 60 ? '0 0% 10%' : '0 0% 95%';
        };
        
        // Helper function for visible borders
        const getContrastingBorder = (backgroundL: number, h: number, s: number) => {
          if (backgroundL > 70) {
            return `${h} ${Math.max(s - 10, 0)}% ${Math.max(backgroundL - 25, 15)}%`;
          } else {
            return `${h} ${Math.max(s - 10, 0)}% ${Math.min(backgroundL + 25, 85)}%`;
          }
        };
        
        // Set background colors with proper contrast
        root.style.setProperty('--background', `${h} ${Math.max(s - 30, 5)}% ${bgLightness}%`);
        root.style.setProperty('--foreground', getContrastingText(bgLightness));
        
        // Set card colors
        root.style.setProperty('--card', `${h} ${Math.max(s - 35, 5)}% ${cardLightness}%`);
        root.style.setProperty('--card-foreground', getContrastingText(cardLightness));
        
        // Set muted colors
        root.style.setProperty('--muted', `${h} ${Math.max(s - 25, 5)}% ${mutedLightness}%`);
        root.style.setProperty('--muted-foreground', '0 0% 40%'); // Always readable
        
        // Set border colors with proper visibility
        root.style.setProperty('--border', getContrastingBorder(bgLightness, h, s));
        root.style.setProperty('--input', getContrastingBorder(bgLightness, h, s));
        
        // Set popover colors
        root.style.setProperty('--popover', `${h} ${Math.max(s - 30, 5)}% ${bgLightness}%`);
        root.style.setProperty('--popover-foreground', getContrastingText(bgLightness));
        
        // Set sidebar colors
        const sidebarLightness = Math.min(Math.max(l + 30, 88), 95);
        root.style.setProperty('--sidebar-background', `${h} ${Math.max(s - 25, 5)}% ${sidebarLightness}%`);
        root.style.setProperty('--sidebar-foreground', getContrastingText(sidebarLightness));
        root.style.setProperty('--sidebar-border', getContrastingBorder(sidebarLightness, h, s));
        
        // Save to preferences
        await updatePreference('customPrimaryColor', color);
      } else {
        // Secondary color now acts as accent/button color (what primary was before)
        root.style.setProperty('--primary', hslString);
        root.style.setProperty('--primary-foreground', l > 50 ? '0 0% 100%' : '0 0% 0%');
        root.style.setProperty('--primary-muted', `${h} ${Math.max(s - 20, 0)}% ${Math.min(l + 40, 95)}%`);
        root.style.setProperty('--primary-dark', `${h} ${s}% ${Math.max(l - 15, 5)}%`);
        
        // Set accent colors
        root.style.setProperty('--accent', `${(h + 15) % 360} ${s}% ${l}%`);
        root.style.setProperty('--accent-foreground', l > 50 ? '0 0% 100%' : '0 0% 0%');
        root.style.setProperty('--accent-muted', `${(h + 15) % 360} ${Math.max(s - 20, 0)}% ${Math.min(l + 40, 95)}%`);
        
        // Set sidebar interactive colors
        root.style.setProperty('--sidebar-primary', hslString);
        root.style.setProperty('--sidebar-primary-foreground', l > 50 ? '0 0% 100%' : '0 0% 0%');
        root.style.setProperty('--sidebar-accent', `${(h + 10) % 360} ${s}% ${l}%`);
        root.style.setProperty('--sidebar-accent-foreground', l > 50 ? '0 0% 100%' : '0 0% 0%');
        
        // Set ring color for focus states
        root.style.setProperty('--ring', hslString);
        
        // Save to preferences
        await updatePreference('customSecondaryColor', color);
      }
      
      toast({
        title: "Color applied!",
        description: `Your custom ${colorType} color has been set.`,
      });
    } catch (error) {
      console.error('Error applying custom color:', error);
      toast({
        title: "Error",
        description: "Failed to apply custom color. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingColor(false);
    }
  };

  const handleResetColors = () => {
    const defaultPrimary = '#3b82f6';
    const defaultSecondary = '#8b5cf6';
    setCustomPrimaryColor(defaultPrimary);
    setCustomSecondaryColor(defaultSecondary);
    
    const root = document.documentElement;
    // Remove all custom color properties to restore defaults
    const propertiesToReset = [
      '--primary', '--primary-foreground', '--primary-muted', '--primary-dark',
      '--secondary', '--secondary-foreground',
      '--accent', '--accent-foreground', '--accent-muted',
      '--background', '--foreground',
      '--card', '--card-foreground',
      '--muted', '--muted-foreground',
      '--border', '--input',
      '--popover', '--popover-foreground',
      '--sidebar-background', '--sidebar-foreground', '--sidebar-border',
      '--sidebar-primary', '--sidebar-primary-foreground',
      '--sidebar-accent', '--sidebar-accent-foreground',
      '--ring'
    ];
    
    propertiesToReset.forEach(prop => root.style.removeProperty(prop));
    
    toast({
      title: "Colors reset",
      description: "Theme colors have been reset to default.",
    });
  };

  // Auto-save notification changes
  const updateNotificationSetting = async (key: keyof typeof notifications, value: boolean) => {
    const newNotifications = { ...notifications, [key]: value };
    setNotifications(newNotifications);

    if (user) {
      try {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            settings_type: 'notifications',
            settings_data: newNotifications,
          });

        if (error) {
          console.error('Error saving notifications to database:', error);
        } else {
          toast({
            title: "Settings saved",
            description: "Your notification preferences have been updated.",
          });
        }
      } catch (error) {
        console.error('Failed to save notifications:', error);
      }
    }
  };

  // Comprehensive profanity filter
  const profanityList = [
    'damn', 'hell', 'shit', 'fuck', 'bitch', 'ass', 'crap', 'piss', 'bastard', 'idiot', 'stupid',
    'asshole', 'dumbass', 'jackass', 'dickhead', 'motherfucker', 'bullshit', 'goddamn', 'jesus christ',
    'wtf', 'stfu', 'gtfo', 'fml', 'omfg', 'lmfao', 'rotfl', 'dildo', 'penis', 'vagina', 'boobs',
    'tits', 'cock', 'dick', 'pussy', 'whore', 'slut', 'hooker', 'prostitute', 'sex', 'porn', 'cunt',
    'retard', 'retarded', 'gay', 'faggot', 'homo', 'lesbian', 'dyke', 'tranny', 'nigger', 'nigga',
    'spic', 'wetback', 'chink', 'gook', 'jap', 'kike', 'wop', 'honky', 'cracker', 'redneck'
  ];

  const containsProfanity = (text: string): boolean => {
    const lowercaseText = text.toLowerCase().replace(/[^a-z\s]/g, ''); // Remove special chars
    return profanityList.some(word => {
      // Check for whole word matches and common letter substitutions
      const pattern = new RegExp(`\\b${word.replace(/./g, char => {
        const substitutions: {[key: string]: string} = {
          'a': '[a@4]', 'e': '[e3]', 'i': '[i1!]', 'o': '[o0]', 's': '[s5$]', 't': '[t7]'
        };
        return substitutions[char] || char;
      })}\\b`, 'i');
      return pattern.test(lowercaseText);
    });
  };

  const handleSignOut = async () => {
    console.log('Sign out button clicked');
    console.log('Current user:', user);
    console.log('User ID:', user?.id);
    
    try {
      console.log('Calling signOut function...');
      await signOut();
      console.log('SignOut completed successfully');
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
    } catch (error) {
      console.error('Sign out error in Settings:', error);
      toast({
        title: "Sign out failed",
        description: "An error occurred while signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'default';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };
  
  // Sync profile data to local state when profile loads
  useEffect(() => {
    if (profile) {
      setEditedProfile({
        display_name: profile.display_name || '',
        school: profile.school || '',
        major: profile.major || '',
        campus_location: profile.campus_location || '',
        bio: profile.bio || '',
        graduation_year: profile.graduation_year?.toString() || '',
        is_public: profile.is_public ?? true,
        timezone: profile.timezone || 'America/New_York'
      });
      setHasUnsavedChanges(false);
    }
  }, [profile]);

  const handleProfileChange = (field: string, value: string) => {
    // Special validation for major field
    if (field === 'major') {
      if (containsProfanity(value)) {
        setMajorError('Please use appropriate language for your major field.');
        return; // Don't update the value
      } else {
        setMajorError(''); // Clear error if text is clean
      }
    }
    
    setEditedProfile(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    
    // Update live profile context for instant navigation updates
    updateLiveProfile(field, value);
  };

  const handleSaveProfile = async () => {
    const updates = {
      ...editedProfile,
      graduation_year: editedProfile.graduation_year ? parseInt(editedProfile.graduation_year) : undefined
    };
    await updateProfile(updates);
    setHasUnsavedChanges(false);
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      default: return <Link className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic': return '🎓';
      case 'calendar': return '📅';
      case 'communication': return '💬';
      default: return '🔗';
    }
  };

  const tabs = [
    { id: 'accounts', label: 'Account Linking', icon: Link },
    { id: 'preferences', label: 'System Preferences', icon: Palette },
    { id: 'sleep', label: 'Sleep Schedule', icon: Clock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'signout', label: 'Sign Out', icon: LogOut },
  ];

  const renderAccountLinking = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Account Linking</h2>
        <p className="text-muted-foreground">
          Connect your academic and productivity accounts to unify your schedule
        </p>
      </div>

      <Alert className="border-accent/20 bg-accent/5">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-foreground">
          <strong>Secure OAuth Integration:</strong> All account connections use industry-standard OAuth 2.0 
          authentication. Your credentials are never stored - only secure access tokens.
        </AlertDescription>
      </Alert>

      {/* Quick Access to Full Integration Setup */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Calender Integration</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Connect your Google Calendar to automatically sync events and free time blocks
              </p>
            </div>
            <Button 
              onClick={() => {
                console.log("Button clicked - navigating to integrations");
                window.location.hash = '#integrations';
              }}
              className="bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Setup Integrations
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Notification Preferences</h2>
        <p className="text-muted-foreground">
          Choose what notifications you'd like to receive
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Academic Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground">Assignment Reminders</h4>
              <p className="text-sm text-muted-foreground">Get notified about upcoming assignments</p>
            </div>
            <Switch 
              checked={notifications.assignments} 
              onCheckedChange={(checked) => updateNotificationSetting('assignments', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground">Deadline Alerts</h4>
              <p className="text-sm text-muted-foreground">Urgent notifications for approaching deadlines</p>
            </div>
            <Switch 
              checked={notifications.deadlines} 
              onCheckedChange={(checked) => updateNotificationSetting('deadlines', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground">Study Reminders</h4>
              <p className="text-sm text-muted-foreground">Reminders for scheduled study blocks</p>
            </div>
            <Switch 
              checked={notifications.studyReminders} 
              onCheckedChange={(checked) => updateNotificationSetting('studyReminders', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground">Sync Errors</h4>
              <p className="text-sm text-muted-foreground">Get notified when account sync fails</p>
            </div>
            <Switch 
              checked={notifications.syncErrors} 
              onCheckedChange={(checked) => updateNotificationSetting('syncErrors', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSystemPreferences = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">System Preferences</h2>
        <p className="text-muted-foreground">
          Customize your app experience with themes, fonts, and display options
        </p>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            App Theme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: 'default', name: 'Default', colors: ['bg-blue-500', 'bg-purple-500'], icon: '🎨' },
              { id: 'dark', name: 'Dark Mode', colors: ['bg-gray-800', 'bg-gray-600'], icon: '🌙' },
              { id: 'warm', name: 'Warm', colors: ['bg-orange-500', 'bg-red-500'], icon: '🔥' },
              { id: 'ocean', name: 'Ocean', colors: ['bg-cyan-500', 'bg-blue-600'], icon: '🌊' },
              { id: 'forest', name: 'Forest', colors: ['bg-green-600', 'bg-emerald-500'], icon: '🌲' },
              { id: 'sunset', name: 'Sunset', colors: ['bg-pink-500', 'bg-purple-600'], icon: '🌅' },
              { id: 'custom', name: 'Custom', colors: ['bg-gradient-to-r from-purple-500 to-blue-500'], icon: '🎛️' },
            ].map((theme) => (
              <Button
                key={theme.id}
                variant={preferences.theme === theme.id ? 'default' : 'outline'}
                className={`h-20 flex flex-col items-center justify-center gap-2 ${
                  preferences.theme === theme.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => updatePreference('theme', theme.id as any)}
              >
                <div className="flex gap-1">
                  {theme.colors.map((color, index) => (
                    <div key={index} className={`w-4 h-4 rounded-full ${color}`} />
                  ))}
                </div>
                <span className="text-xs font-medium">
                  {theme.icon} {theme.name}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Theme Colors - Only show when Custom theme is selected */}
      {preferences.theme === 'custom' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Custom Colors
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Customize your theme colors. Select the "Custom" theme above to use these settings.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
          <div className="space-y-6">
            {/* Primary Color Section */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Primary Color</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Changes the website background, cards, and overall theme colors
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div 
                  className="w-16 h-16 rounded-lg border-2 border-border/20 cursor-pointer hover:border-border/40 transition-colors"
                  style={{ backgroundColor: customPrimaryColor }}
                  onClick={() => document.getElementById('primary-color-input')?.click()}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={customPrimaryColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                          setCustomPrimaryColor(value);
                        }
                      }}
                      placeholder="#3b82f6"
                      className="w-32 font-mono text-sm"
                      maxLength={7}
                    />
                    <input
                      id="primary-color-input"
                      type="color"
                      value={customPrimaryColor}
                      onChange={(e) => setCustomPrimaryColor(e.target.value)}
                      className="sr-only"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyCustomColor('primary')}
                      disabled={isChangingColor}
                      className="flex items-center gap-2"
                    >
                      {isChangingColor ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Palette className="h-4 w-4" />
                      )}
                      Apply
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick Color Presets for Primary */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-foreground">Primary Presets</h5>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { name: 'Blue', color: '#3b82f6' },
                    { name: 'Purple', color: '#8b5cf6' },
                    { name: 'Green', color: '#10b981' },
                    { name: 'Orange', color: '#f59e0b' },
                    { name: 'Red', color: '#ef4444' },
                    { name: 'Pink', color: '#ec4899' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      className="w-8 h-8 rounded-md border-2 border-border/20 hover:border-border/40 transition-colors"
                      style={{ backgroundColor: preset.color }}
                      onClick={() => setCustomPrimaryColor(preset.color)}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Secondary Color Section */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Secondary Color</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Controls buttons, links, and interactive accent elements
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div 
                  className="w-16 h-16 rounded-lg border-2 border-border/20 cursor-pointer hover:border-border/40 transition-colors"
                  style={{ backgroundColor: customSecondaryColor }}
                  onClick={() => document.getElementById('secondary-color-input')?.click()}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={customSecondaryColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                          setCustomSecondaryColor(value);
                        }
                      }}
                      placeholder="#8b5cf6"
                      className="w-32 font-mono text-sm"
                      maxLength={7}
                    />
                    <input
                      id="secondary-color-input"
                      type="color"
                      value={customSecondaryColor}
                      onChange={(e) => setCustomSecondaryColor(e.target.value)}
                      className="sr-only"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyCustomColor('secondary')}
                      disabled={isChangingColor}
                      className="flex items-center gap-2"
                    >
                      {isChangingColor ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Palette className="h-4 w-4" />
                      )}
                      Apply
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick Color Presets for Secondary */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-foreground">Secondary Presets</h5>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { name: 'Purple', color: '#8b5cf6' },
                    { name: 'Indigo', color: '#6366f1' },
                    { name: 'Teal', color: '#14b8a6' },
                    { name: 'Amber', color: '#f59e0b' },
                    { name: 'Rose', color: '#f43f5e' },
                    { name: 'Cyan', color: '#06b6d4' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      className="w-8 h-8 rounded-md border-2 border-border/20 hover:border-border/40 transition-colors"
                      style={{ backgroundColor: preset.color }}
                      onClick={() => setCustomSecondaryColor(preset.color)}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Color Intensity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Color Intensity</label>
                <span className="text-sm text-muted-foreground">100%</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="100"
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(90deg, ${customSecondaryColor} 0%, ${customPrimaryColor} 100%)`
                  }}
                />
              </div>
            </div>

            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetColors}
              className="w-full"
            >
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Text Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Text Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground">Bold Text</h4>
              <p className="text-sm text-muted-foreground">Make text throughout the app bolder for better readability</p>
            </div>
            <Switch 
              checked={preferences.boldText} 
              onCheckedChange={(checked) => updatePreference('boldText', checked)}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-foreground">Text Size</h4>
              <p className="text-sm text-muted-foreground">Adjust the size of text throughout the app</p>
            </div>
            <Select 
              value={preferences.textSize} 
              onValueChange={(value) => updatePreference('textSize', value as any)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small - Compact text for more content</SelectItem>
                <SelectItem value="medium">Medium - Standard readable text</SelectItem>
                <SelectItem value="large">Large - Larger text for better readability</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Display Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-500/20 bg-green-50 dark:bg-green-900/10">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-400">
              <strong>Auto-Save Enabled:</strong> All your preference changes are automatically saved to your account. 
              They'll be restored whenever you sign in, on any device.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <h5 className="font-medium text-foreground mb-2">Current Settings:</h5>
              <ul className="space-y-1">
                <li>• Theme: {preferences.theme.charAt(0).toUpperCase() + preferences.theme.slice(1)}</li>
                <li>• Bold Text: {preferences.boldText ? 'Enabled' : 'Disabled'}</li>
                <li>• Text Size: {preferences.textSize.charAt(0).toUpperCase() + preferences.textSize.slice(1)}</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-foreground mb-2">Quick Preview:</h5>
              <div className={`p-3 rounded-lg border ${preferences.boldText ? 'font-semibold' : ''}`}>
                <p style={{ fontSize: preferences.textSize === 'small' ? '0.875rem' : preferences.textSize === 'large' ? '1.125rem' : '1rem' }}>
                  This is how your text will appear with your current preferences.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    await uploadAvatar(file);
  };

  const renderProfile = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Profile Settings</h2>
        <p className="text-muted-foreground">
          Manage your personal information and academic details
        </p>
      </div>

      {profileLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Avatar Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Profile Picture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-lg">
                    {profile?.display_name?.charAt(0)?.toUpperCase() || 
                     user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="space-y-2">
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG or WebP. Max size 5MB.
                  </p>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={editedProfile.display_name}
                  onChange={(e) => handleProfileChange('display_name', e.target.value)}
                  placeholder="Enter your display name"
                  autoComplete="off"
                  data-form-type="other"
                  name="display-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed from this page
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Academic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎓 Academic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school">School/University</Label>
                <Select 
                  value={editedProfile.school} 
                  onValueChange={(value) => handleProfileChange('school', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your school or university" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {getAllPublicUniversities().map((university) => (
                      <SelectItem key={university.id} value={university.name}>
                        {university.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="major">Major</Label>
                <Select 
                  value={editedProfile.major} 
                  onValueChange={(value) => handleProfileChange('major', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your major" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {collegeMajors.map((major) => (
                      <SelectItem key={major} value={major}>
                        {major}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {majorError && (
                  <p className="text-xs text-red-500">{majorError}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="campus_location">Campus Location</Label>
                <Input
                  id="campus_location"
                  value={editedProfile.campus_location}
                  onChange={(e) => handleProfileChange('campus_location', e.target.value)}
                  placeholder="e.g., Main Campus, Downtown, Online"
                  autoComplete="off"
                  data-form-type="other"
                  name="campus-location"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={editedProfile.bio}
                  onChange={(e) => handleProfileChange('bio', e.target.value)}
                  placeholder="Tell others about yourself..."
                  autoComplete="off"
                  data-form-type="other"
                  name="user-bio"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="graduation_year">Graduation Year</Label>
                <Input
                  id="graduation_year"
                  type="number"
                  value={editedProfile.graduation_year}
                  onChange={(e) => handleProfileChange('graduation_year', e.target.value)}
                  placeholder="e.g., 2025"
                  min="2020"
                  max="2030"
                  autoComplete="off"
                  data-form-type="other"
                  name="graduation-year"
                />
              </div>
            </CardContent>
          </Card>


          {/* Timezone Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🌍 Location & Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={editedProfile.timezone} 
                  onValueChange={(value) => handleProfileChange('timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska Time</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          {hasUnsavedChanges && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      You have unsaved changes
                    </span>
                  </div>
                  <Button 
                    onClick={handleSaveProfile}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );

  const renderComingSoon = (title: string) => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">This section is coming soon!</p>
      </div>
    </div>
  );

  const renderCourseIcons = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Course Icons</h2>
        <p className="text-muted-foreground">Customize icons for your courses</p>
      </div>

      {courses.length > 0 ? (
        <div className="space-y-4">
          {courses.map((course) => {
            const currentIconId = courseIcons_State[course.code] || 'book-open';
            const categories = getCourseIconCategories();
            
            return (
              <Card key={course.code}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    {course.code}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Choose an icon that best represents this course:
                    </p>
                    <div className="grid grid-cols-10 gap-2">
                      {courseIcons.map((icon) => {
                        const IconComponent = icon.icon;
                        return (
                          <Button
                            key={icon.id}
                            variant={currentIconId === icon.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateCourseIcon(course.code, icon.id)}
                            className="h-10 w-10 p-0"
                            title={icon.name}
                          >
                            <IconComponent className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No courses found. Connect Canvas to customize course icons.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderSignOut = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground">Email</h4>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Account Status</h4>
              <Badge variant="default">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign Out</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Signing out will end your current session and redirect you to the sign-in page.
            </p>
            <Button 
              variant="destructive" 
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSleepSchedule = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sleep Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-medium text-foreground">Daily Schedule</h4>
              <p className="text-sm text-muted-foreground">Set your wake-up and bedtime for accurate free time calculations</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Wake-up Time */}
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-foreground">Wake-up Time</h4>
                  <p className="text-sm text-muted-foreground">When you start your day</p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl p-6 border border-blue-100 dark:border-blue-800/30">
                  <div className="text-center mb-4">
                    <div className="text-4xl font-mono font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {(() => {
                        const [hours, minutes] = preferences.wakeUpTime.split(':').map(Number);
                        const period = hours >= 12 ? 'PM' : 'AM';
                        const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                        return `${hours12}:${minutes.toString().padStart(2, '0')}`;
                      })()}
                    </div>
                    <div className="text-lg font-semibold text-blue-600/80 dark:text-blue-400/80 mb-2">
                      {(() => {
                        const [hours] = preferences.wakeUpTime.split(':').map(Number);
                        return hours >= 12 ? 'PM' : 'AM';
                      })()}
                    </div>
                    <div className="text-xs text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider">
                      Morning
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-blue-200 dark:border-blue-700"
                        onClick={() => {
                          const currentHour = parseInt(preferences.wakeUpTime.split(':')[0]);
                          const newHour = currentHour > 0 ? currentHour - 1 : 23;
                          const minutes = preferences.wakeUpTime.split(':')[1];
                          updatePreference('wakeUpTime', `${newHour.toString().padStart(2, '0')}:${minutes}`);
                        }}
                      >
                        <span className="text-blue-600 dark:text-blue-400">-1 Hour</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-blue-200 dark:border-blue-700"
                        onClick={() => {
                          const hour = preferences.wakeUpTime.split(':')[0];
                          const currentMin = parseInt(preferences.wakeUpTime.split(':')[1]);
                          const newMin = currentMin >= 15 ? currentMin - 15 : 45;
                          updatePreference('wakeUpTime', `${hour}:${newMin.toString().padStart(2, '0')}`);
                        }}
                      >
                        <span className="text-blue-600 dark:text-blue-400">-15 Min</span>
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-blue-200 dark:border-blue-700"
                        onClick={() => {
                          const currentHour = parseInt(preferences.wakeUpTime.split(':')[0]);
                          const newHour = currentHour < 23 ? currentHour + 1 : 0;
                          const minutes = preferences.wakeUpTime.split(':')[1];
                          updatePreference('wakeUpTime', `${newHour.toString().padStart(2, '0')}:${minutes}`);
                        }}
                      >
                        <span className="text-blue-600 dark:text-blue-400">+1 Hour</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-blue-200 dark:border-blue-700"
                        onClick={() => {
                          const hour = preferences.wakeUpTime.split(':')[0];
                          const currentMin = parseInt(preferences.wakeUpTime.split(':')[1]);
                          const newMin = currentMin <= 45 ? currentMin + 15 : 0;
                          updatePreference('wakeUpTime', `${hour}:${newMin.toString().padStart(2, '0')}`);
                        }}
                      >
                        <span className="text-blue-600 dark:text-blue-400">+15 Min</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bedtime */}
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-foreground">Bedtime</h4>
                  <p className="text-sm text-muted-foreground">When you wind down</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 rounded-xl p-6 border border-purple-100 dark:border-purple-800/30">
                  <div className="text-center mb-4">
                    <div className="text-4xl font-mono font-bold text-purple-600 dark:text-purple-400 mb-1">
                      {(() => {
                        const [hours, minutes] = preferences.bedTime.split(':').map(Number);
                        const period = hours >= 12 ? 'PM' : 'AM';
                        const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                        return `${hours12}:${minutes.toString().padStart(2, '0')}`;
                      })()}
                    </div>
                    <div className="text-lg font-semibold text-purple-600/80 dark:text-purple-400/80 mb-2">
                      {(() => {
                        const [hours] = preferences.bedTime.split(':').map(Number);
                        return hours >= 12 ? 'PM' : 'AM';
                      })()}
                    </div>
                    <div className="text-xs text-purple-600/70 dark:text-purple-400/70 uppercase tracking-wider">
                      Evening
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-purple-200 dark:border-purple-700"
                        onClick={() => {
                          const currentHour = parseInt(preferences.bedTime.split(':')[0]);
                          const newHour = currentHour > 0 ? currentHour - 1 : 23;
                          const minutes = preferences.bedTime.split(':')[1];
                          updatePreference('bedTime', `${newHour.toString().padStart(2, '0')}:${minutes}`);
                        }}
                      >
                        <span className="text-purple-600 dark:text-purple-400">-1 Hour</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-purple-200 dark:border-purple-700"
                        onClick={() => {
                          const hour = preferences.bedTime.split(':')[0];
                          const currentMin = parseInt(preferences.bedTime.split(':')[1]);
                          const newMin = currentMin >= 15 ? currentMin - 15 : 45;
                          updatePreference('bedTime', `${hour}:${newMin.toString().padStart(2, '0')}`);
                        }}
                      >
                        <span className="text-purple-600 dark:text-purple-400">-15 Min</span>
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-purple-200 dark:border-purple-700"
                        onClick={() => {
                          const currentHour = parseInt(preferences.bedTime.split(':')[0]);
                          const newHour = currentHour < 23 ? currentHour + 1 : 0;
                          const minutes = preferences.bedTime.split(':')[1];
                          updatePreference('bedTime', `${newHour.toString().padStart(2, '0')}:${minutes}`);
                        }}
                      >
                        <span className="text-purple-600 dark:text-purple-400">+1 Hour</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full hover-scale bg-white/50 hover:bg-white/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/80 border-purple-200 dark:border-purple-700"
                        onClick={() => {
                          const hour = preferences.bedTime.split(':')[0];
                          const currentMin = parseInt(preferences.bedTime.split(':')[1]);
                          const newMin = currentMin <= 45 ? currentMin + 15 : 0;
                          updatePreference('bedTime', `${hour}:${newMin.toString().padStart(2, '0')}`);
                        }}
                      >
                        <span className="text-purple-600 dark:text-purple-400">+15 Min</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="bg-muted/30 p-4 rounded-lg">
            <h5 className="font-medium text-foreground mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              How this improves your dashboard
            </h5>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Free time calculation based on your actual awake hours</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Accounts for 6 hours of daily essentials (meals, personal care, commuting, hygiene, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Shows realistic available time after scheduled tasks and events</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Helps with better time management and planning</span>
              </li>
            </ul>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-background border rounded-lg p-4">
              <div className="text-2xl font-bold text-primary">
                {(() => {
                  const [wakeHour, wakeMin] = preferences.wakeUpTime.split(':').map(Number);
                  const [bedHour, bedMin] = preferences.bedTime.split(':').map(Number);
                  let awakeHours = 0;
                  if (bedHour > wakeHour) {
                    awakeHours = (bedHour - wakeHour) + (bedMin - wakeMin) / 60;
                  } else {
                    awakeHours = (24 - wakeHour + bedHour) + (bedMin - wakeMin) / 60;
                  }
                  return awakeHours.toFixed(1);
                })()}h
              </div>
              <div className="text-sm text-muted-foreground">Total Awake Hours</div>
            </div>
            
            <div className="bg-background border rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">6h</div>
              <div className="text-sm text-muted-foreground">Daily Essentials</div>
            </div>
            
            <div className="bg-background border rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const endOfToday = new Date(today);
                  endOfToday.setHours(23, 59, 59, 999);

                  // Calculate distributed assignment time for today
                  const upcomingTasks = userTasks.filter(task => {
                    if (!task.due_date || task.completion_status === 'completed') return false;
                    const dueDate = new Date(task.due_date);
                    const threeDaysFromNow = new Date(today);
                    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
                    // Include tasks due within the next 3 days OR overdue tasks
                    return dueDate <= threeDaysFromNow;
                  });

                  // Include overdue Canvas assignments
                  const overdueAssignments = userEvents.filter(event => {
                    if (event.event_type !== 'assignment' || event.is_completed) return false;
                    if (!event.start_time) return false;
                    const dueDate = new Date(event.start_time);
                    return dueDate < today; // Overdue assignments
                  });

                  const eventsToday = userEvents.filter(event => {
                    if (!event.start_time || !event.end_time) return false;
                    if (event.event_type === 'assignment') return false; // Handle assignments separately
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);
                    return (eventStart >= today && eventStart <= endOfToday) || 
                           (eventEnd >= today && eventEnd <= endOfToday);
                  });

                  let totalScheduledHours = 0;
                  
                  // Add event durations
                  eventsToday.forEach(event => {
                    if (event.start_time && event.end_time) {
                      const start = new Date(event.start_time);
                      const end = new Date(event.end_time);
                      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      totalScheduledHours += duration;
                    } else {
                      totalScheduledHours += 1;
                    }
                  });

                  // Distribute task time across available days
                  upcomingTasks.forEach(task => {
                    const estimatedHours = task.estimated_hours || 2; // Default to 2 hours for assignments
                    const dueDate = new Date(task.due_date);
                    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const workDays = Math.max(1, daysUntilDue); // At least 1 day
                    
                    // Distribute hours across work days, with more time closer to due date
                    const dailyHours = estimatedHours / workDays;
                    totalScheduledHours += dailyHours;
                  });

                  // Add overdue assignment workload (prioritize these - assume 1.5 hours each for today)
                  overdueAssignments.forEach(assignment => {
                    totalScheduledHours += 1.5; // Urgent work needed today
                  });

                  return totalScheduledHours.toFixed(1);
                })()}h
              </div>
              <div className="text-sm text-muted-foreground">Today's Work Load</div>
            </div>
            
            <div className="bg-background border rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {(() => {
                  const [wakeHour, wakeMin] = preferences.wakeUpTime.split(':').map(Number);
                  const [bedHour, bedMin] = preferences.bedTime.split(':').map(Number);
                  let awakeHours = 0;
                  if (bedHour > wakeHour) {
                    awakeHours = (bedHour - wakeHour) + (bedMin - wakeMin) / 60;
                  } else {
                    awakeHours = (24 - wakeHour + bedHour) + (bedMin - wakeMin) / 60;
                  }

                  // Calculate distributed assignment time for today
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const endOfToday = new Date(today);
                  endOfToday.setHours(23, 59, 59, 999);

                  const upcomingTasks = userTasks.filter(task => {
                    if (!task.due_date || task.completion_status === 'completed') return false;
                    const dueDate = new Date(task.due_date);
                    const threeDaysFromNow = new Date(today);
                    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
                    return dueDate >= today && dueDate <= threeDaysFromNow;
                  });

                  const eventsToday = userEvents.filter(event => {
                    if (!event.start_time || !event.end_time) return false;
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);
                    return (eventStart >= today && eventStart <= endOfToday) || 
                           (eventEnd >= today && eventEnd <= endOfToday);
                  });

                  let totalScheduledHours = 0;
                  
                  eventsToday.forEach(event => {
                    if (event.start_time && event.end_time) {
                      const start = new Date(event.start_time);
                      const end = new Date(event.end_time);
                      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      totalScheduledHours += duration;
                    } else {
                      totalScheduledHours += 1;
                    }
                  });

                  // Distribute task time across available days
                  upcomingTasks.forEach(task => {
                    const estimatedHours = task.estimated_hours || 2;
                    const dueDate = new Date(task.due_date);
                    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const workDays = Math.max(1, daysUntilDue);
                    
                    const dailyHours = estimatedHours / workDays;
                    totalScheduledHours += dailyHours;
                  });

                  const available = Math.max(0, awakeHours - 6 - totalScheduledHours);
                  return available.toFixed(1);
                })()}h
              </div>
              <div className="text-sm text-muted-foreground">Free Time Today</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  const renderTabContent = () => {
    switch (activeTab) {
      case 'accounts':
        return renderAccountLinking();
      case 'preferences':
        return renderSystemPreferences();
      case 'sleep':
        return renderSleepSchedule();
      case 'course-icons':
        return renderCourseIcons();
      case 'notifications':
        return renderNotifications();
      case 'profile':
        return renderProfile();
      case 'privacy':
        return renderComingSoon('Privacy & Security');
      case 'signout':
        return renderSignOut();
      default:
        return renderAccountLinking();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <Button
                      key={tab.id}
                      variant={activeTab === tab.id ? "default" : "ghost"}
                      className={`w-full justify-start ${
                        activeTab === tab.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon className="h-4 w-4 mr-3" />
                      {tab.label}
                    </Button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};