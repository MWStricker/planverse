import { useState, useRef, useEffect } from "react";
import { Settings as SettingsIcon, Link, CheckCircle, AlertCircle, ExternalLink, Shield, Bell, User, Palette, LogOut, Monitor, Type, Zap, Camera, Upload, Save } from "lucide-react";
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

export const Settings = () => {
  const [activeTab, setActiveTab] = useState('accounts');
  const [notifications, setNotifications] = useState({
    assignments: true,
    deadlines: true,
    studyReminders: true,
    syncErrors: false,
  });
  const { signOut, user } = useAuth();
  const { toast } = useToast();
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
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
    } catch (error) {
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

      {/* Academic Accounts */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          🎓 Academic Accounts
        </h3>
        <div className="space-y-3">
          {accountIntegrations.filter(acc => acc.category === 'academic').map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{account.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground">{account.name}</h4>
                        <Badge variant={getStatusColor(account.status)} className="flex items-center gap-1">
                          {getStatusIcon(account.status)}
                          {account.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{account.description}</p>
                      {account.connectedEmail && (
                        <p className="text-xs text-muted-foreground">Connected: {account.connectedEmail}</p>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant={account.status === 'connected' ? 'outline' : 'default'}
                    className={account.status !== 'connected' ? 'bg-gradient-to-r from-primary to-accent text-white border-0' : ''}
                  >
                    {account.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Calendar Accounts */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          📅 Calendar Accounts
        </h3>
        <div className="space-y-3">
          {accountIntegrations.filter(acc => acc.category === 'calendar').map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{account.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground">{account.name}</h4>
                        <Badge variant={getStatusColor(account.status)} className="flex items-center gap-1">
                          {getStatusIcon(account.status)}
                          {account.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{account.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {account.features.map((feature) => (
                          <Badge key={feature} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant={account.status === 'connected' ? 'outline' : 'default'}
                    className={account.status !== 'connected' ? 'bg-gradient-to-r from-primary to-accent text-white border-0' : ''}
                  >
                    {account.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Communication Accounts */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          💬 Communication Accounts
        </h3>
        <div className="space-y-3">
          {accountIntegrations.filter(acc => acc.category === 'communication').map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{account.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground">{account.name}</h4>
                        <Badge variant={getStatusColor(account.status)} className="flex items-center gap-1">
                          {getStatusIcon(account.status)}
                          {account.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{account.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {account.features.map((feature) => (
                          <Badge key={feature} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant={account.status === 'connected' ? 'outline' : 'default'}
                    className={account.status !== 'connected' ? 'bg-gradient-to-r from-primary to-accent text-white border-0' : ''}
                  >
                    {account.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
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
          <Alert className="border-accent/20 bg-accent/5">
            <Zap className="h-4 w-4" />
            <AlertDescription className="text-foreground">
              <strong>Performance Tip:</strong> Preferences are saved automatically and applied instantly. 
              Changes sync across all your devices when signed in.
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
                <Input
                  id="school"
                  value={editedProfile.school}
                  onChange={(e) => handleProfileChange('school', e.target.value)}
                  placeholder="Enter your school or university"
                />
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
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={editedProfile.bio}
                  onChange={(e) => handleProfileChange('bio', e.target.value)}
                  placeholder="Tell others about yourself..."
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'accounts':
        return renderAccountLinking();
      case 'preferences':
        return renderSystemPreferences();
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