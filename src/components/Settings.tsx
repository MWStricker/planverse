import { useState } from "react";
import { Settings as SettingsIcon, Link, CheckCircle, AlertCircle, ExternalLink, Shield, Bell, User, Palette, LogOut, Monitor, Type, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { usePreferences } from "@/hooks/usePreferences";

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
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, assignments: checked }))}
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
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, deadlines: checked }))}
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
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, studyReminders: checked }))}
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
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, syncErrors: checked }))}
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
        return renderComingSoon('Profile Settings');
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