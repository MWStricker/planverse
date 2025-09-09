import { useState } from "react";
import { Settings as SettingsIcon, Link, CheckCircle, AlertCircle, ExternalLink, Shield, Bell, User, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

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
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
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

  const renderComingSoon = (title: string) => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">This section is coming soon!</p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'accounts':
        return renderAccountLinking();
      case 'notifications':
        return renderNotifications();
      case 'profile':
        return renderComingSoon('Profile Settings');
      case 'privacy':
        return renderComingSoon('Privacy & Security');
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