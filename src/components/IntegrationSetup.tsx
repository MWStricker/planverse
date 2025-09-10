import { useState } from "react";
import { Calendar, CheckCircle, ExternalLink, AlertTriangle, Zap, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  features: string[];
  requiresBackend: boolean;
}

const integrations: Integration[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync your Google Calendar events and create study blocks',
    icon: '📅',
    status: 'disconnected',
    features: ['Bi-directional sync', 'Event creation', 'Free time detection'],
    requiresBackend: false,
  },
  {
    id: 'apple-calendar',
    name: 'Apple Calendar',
    description: 'Import and sync Apple Calendar via iCloud',
    icon: '🍎',
    status: 'disconnected',
    features: ['iCloud sync', 'CalDAV support', 'Event import'],
    requiresBackend: true,
  },
  {
    id: 'canvas-lms',
    name: 'Canvas LMS',
    description: 'Import assignments, due dates, and course information',
    icon: '🎓',
    status: 'disconnected',
    features: ['Assignment sync', 'Grade weights', 'Course schedules', 'Announcement alerts'],
    requiresBackend: true,
  },
  {
    id: 'blackboard',
    name: 'Blackboard Learn',
    description: 'Sync with Blackboard Learn assignments and schedules',
    icon: '📚',
    status: 'disconnected',
    features: ['Assignment tracking', 'Grade sync', 'Course materials'],
    requiresBackend: true,
  },
];

export const IntegrationSetup = () => {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleGoogleCalendarConnect = async () => {
    try {
      setIsConnecting(true);
      console.log('Starting Google Calendar connection...');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar',
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      console.log('OAuth response:', { data, error });

      if (error) {
        console.error('Google OAuth error:', error);
        toast({
          title: "Connection Failed",
          description: `${error.message} - Please check that Google OAuth is configured in Supabase.`,
          variant: "destructive",
        });
      } else {
        console.log('OAuth request successful, should redirect to Google...');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Connection Failed",
        description: "An unexpected error occurred. Please check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = (integrationId: string) => {
    if (integrationId === 'google-calendar') {
      handleGoogleCalendarConnect();
    } else {
      toast({
        title: "Coming Soon",
        description: `${integrations.find(i => i.id === integrationId)?.name} integration will be available soon.`,
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
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <ExternalLink className="h-4 w-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Connect Your Services</h1>
        <p className="text-muted-foreground">
          Integrate with your calendars and learning management systems for a unified experience
        </p>
      </div>

      {/* Integration Notice */}
      <Alert className="border-primary/20 bg-primary/5">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription className="text-foreground">
          <strong>Google Calendar integration ready!</strong> Click "Connect Now" on Google Calendar to start syncing your events.
          Other integrations like Canvas LMS will require additional backend setup.
        </AlertDescription>
      </Alert>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card 
            key={integration.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedIntegration === integration.id ? 'ring-2 ring-primary' : ''
            } ${integration.requiresBackend ? 'opacity-75' : ''}`}
            onClick={() => setSelectedIntegration(integration.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <Badge variant={getStatusColor(integration.status)} className="flex items-center gap-1">
                  {getStatusIcon(integration.status)}
                  {integration.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Features</h4>
                  <div className="flex flex-wrap gap-1">
                    {integration.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {integration.requiresBackend ? (
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    disabled
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Requires Backend Setup
                  </Button>
                ) : (
                  <Button 
                    className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all"
                    onClick={() => handleConnect(integration.id)}
                    disabled={isConnecting && integration.id === 'google-calendar'}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {isConnecting && integration.id === 'google-calendar' ? 'Connecting...' : 'Connect Now'}
                  </Button>
                )}

                {integration.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {integration.lastSync}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Setup Instructions */}
      {selectedIntegration && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Setup Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-medium text-foreground mb-2">OAuth Authentication Required</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  To securely connect external services, this app needs backend infrastructure for:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• OAuth 2.0 / OpenID Connect authentication</li>
                  <li>• Secure API key management</li>
                  <li>• Background sync processes</li>
                  <li>• Data encryption and privacy protection</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                <h4 className="font-medium text-foreground mb-2">Next Steps</h4>
                <ol className="text-sm text-muted-foreground space-y-2 ml-4">
                  <li>1. Connect your project to Supabase for backend functionality</li>
                  <li>2. Set up OAuth providers for secure authentication</li>
                  <li>3. Configure API integrations with Canvas, Google, etc.</li>
                  <li>4. Enable background sync and data processing</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Import Option */}
      <Card className="bg-gradient-to-br from-muted/50 to-muted border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Manual Import Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            While we set up full integrations, you can manually import calendar data:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto p-4 flex-col items-start">
              <div className="font-medium text-foreground">ICS File Import</div>
              <div className="text-sm text-muted-foreground">Upload .ics calendar files</div>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex-col items-start">
              <div className="font-medium text-foreground">CSV Import</div>
              <div className="text-sm text-muted-foreground">Import course schedules from spreadsheets</div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};