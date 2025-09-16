import { useState, useEffect } from "react";
import { Calendar, CheckCircle, ExternalLink, AlertTriangle, Zap, Lock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIntegrationSync } from "@/hooks/useIntegrationSync";

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
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const { syncAllConnections, isProviderConnected, refreshConnections } = useIntegrationSync();

  // Enhanced OAuth callback detection
  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (!user) return;
      
      // Check URL for OAuth return indicators
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const hasOAuthReturn = urlParams.has('access_token') || urlParams.has('code') || window.location.hash.includes('access_token');
      
      console.log('🔍 OAuth callback check:', { 
        hasOAuthReturn, 
        hash: window.location.hash,
        user: user.email 
      });
      
      if (hasOAuthReturn) {
        // Wait a moment for Supabase to process the tokens
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          console.log('🔍 Post-OAuth session:', {
            hasSession: !!session,
            hasProviderToken: !!session?.provider_token,
            tokenLength: session?.provider_token?.length || 0
          });
          
          if (session?.provider_token) {
            console.log('✅ Found provider token, creating connection...');
            const success = await createCalendarConnection(session);
            if (success) {
              setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
              await refreshConnections();
              
              toast({
                title: "Connected Successfully!",
                description: "Google Calendar connected. Starting sync...",
              });
              
              // Auto-trigger real sync
              setTimeout(() => {
                handleSyncCalendar();
              }, 1000);
            }
          } else {
            console.log('⚠️ No provider token found in session');
          }
        }, 2000);
      }
    };

    handleOAuthCallback();
  }, [user]);

  // Auth state change listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔍 Auth state change:', event, {
        hasSession: !!session,
        hasProviderToken: !!session?.provider_token
      });
      
      if (event === 'SIGNED_IN' && session?.provider_token && user) {
        console.log('🔍 Signed in with provider token');
        const success = await createCalendarConnection(session);
        if (success) {
          setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
          await refreshConnections();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [user]);

  // Update integration status based on connections
  useEffect(() => {
    const updateIntegrationStatus = () => {
      const connected = new Set<string>();
      if (isProviderConnected('google')) {
        connected.add('google-calendar');
      }
      setConnectedIntegrations(connected);
    };

    updateIntegrationStatus();
  }, [isProviderConnected]);

  const createCalendarConnection = async (session: any) => {
    console.log('🔍 Creating calendar connection...');
    if (!user) {
      console.error('❌ No user available');
      return false;
    }

    try {
      console.log('🔍 Creating connection with session data...');
      const connectionData = {
        user_id: user.id,
        provider: 'google',
        provider_id: session?.user?.email || user.email || null,
        is_active: true,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        token_expires_at: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        sync_settings: { 
          auto_sync: true, 
          last_sync: null,
          has_provider_token: !!session?.provider_token 
        },
      };

      console.log('🔍 Connection data:', {
        ...connectionData,
        has_provider_token: !!session?.provider_token
      });

      const { data, error } = await supabase
        .from('calendar_connections')
        .upsert(connectionData, {
          onConflict: 'user_id,provider'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error creating connection:', error);
        return false;
      }

      console.log('✅ Calendar connection created/updated:', data);
      return true;
    } catch (error) {
      console.error('❌ Error in createCalendarConnection:', error);
      return false;
    }
  };

  const handleGoogleCalendarConnect = async () => {
    try {
      setIsConnecting(true);
      console.log('🔍 Starting Google Calendar connection...');
      
      // Clear any existing session and force fresh OAuth with Calendar scope
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          redirectTo: `${window.location.origin}/#integrations`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Force consent to ensure we get fresh tokens
            include_granted_scopes: 'true',
          },
        },
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        toast({
          title: "Connection Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('✅ OAuth initiated, redirecting to Google...');
        toast({
          title: "Redirecting to Google",
          description: "Please grant calendar permissions and you'll be redirected back.",
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error in handleGoogleCalendarConnect:', error);
      toast({
        title: "Connection Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncCalendar = async () => {
    try {
      console.log('🔍 Starting calendar sync...');
      setIsConnecting(true);
      
      const result = await syncAllConnections();
      console.log('🔍 Sync result:', result);
      
      await refreshConnections();
      console.log('🔍 Connections refreshed');
      
      toast({
        title: "Sync Complete",
        description: "Google Calendar events have been synced successfully.",
      });
      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Error syncing calendar:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync calendar events. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = (integrationId: string) => {
    console.log('🔍 handleConnect called with:', integrationId);
    
    if (integrationId === 'google-calendar') {
      console.log('🔍 Calling handleGoogleCalendarConnect...');
      handleGoogleCalendarConnect();
    } else {
      console.log('🔍 Integration not implemented:', integrationId);
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

      {/* Manual Connection Check */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-yellow-800 mb-1">Debug: Check Connection Status</h4>
              <p className="text-sm text-yellow-700">
                If you've signed in with Google but don't see the sync button, click here to manually check your connection.
              </p>
            </div>
            <Button 
              onClick={async () => {
                if (!user) {
                  toast({
                    title: "No User",
                    description: "Please sign in first",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                  
                  if (sessionError) {
                    toast({
                      title: "Session Error",
                      description: sessionError.message,
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  console.log('🔍 Session check:', {
                    hasSession: !!session,
                    hasProviderToken: !!session?.provider_token,
                    providers: session?.user?.app_metadata?.providers
                  });
                  
                  if (session?.provider_token) {
                    const success = await createCalendarConnection(session);
                    if (success) {
                      setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
                      await refreshConnections();
                      toast({
                        title: "Connection Created",
                        description: "Google Calendar connection established!",
                      });
                    } else {
                      toast({
                        title: "Connection Failed",
                        description: "Failed to create calendar connection",
                        variant: "destructive",
                      });
                    }
                  } else {
                    toast({
                      title: "No Google Token",
                      description: "Please use 'Connect Now' button first to authenticate with Google.",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error('❌ Check connection error:', error);
                  toast({
                    title: "Check Failed",
                    description: "Connection check failed",
                    variant: "destructive",
                  });
                }
              }}
              variant="outline"
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              Check Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SUPER SIMPLE BUTTON TEST */}
      <Card className="border-red-500 bg-red-100 p-8">
        <CardContent className="p-4">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-red-800">🚨 BUTTON TEST ZONE 🚨</h2>
            <p className="text-red-700">If this button doesn't work, there's a JavaScript issue</p>
            
            <Button 
              onClick={() => {
                alert('BASIC BUTTON WORKS!');
                console.log('BASIC BUTTON CLICKED!');
              }}
              className="bg-green-600 text-white hover:bg-green-700 text-xl p-6"
              size="lg"
            >
              🔥 CLICK ME FIRST 🔥
            </Button>
            
            <Button 
              onClick={() => {
                console.log('🚨 CONNECTION BUTTON CLICKED!');
                alert('CONNECTION BUTTON CLICKED!');
                
                if (!user) {
                  alert('ERROR: No user found!');
                  return;
                }
                
                alert('User found: ' + user.email + ' - Now creating connection...');
                
                supabase
                  .from('calendar_connections')
                  .upsert({
                    user_id: user.id,
                    provider: 'google',
                    provider_id: user.email,
                    is_active: true,
                    scope: 'https://www.googleapis.com/auth/calendar',
                    sync_settings: { auto_sync: true, last_sync: null },
                  }, {
                    onConflict: 'user_id,provider'
                  })
                  .select()
                  .then(({ data, error }) => {
                    if (error) {
                      alert('DATABASE ERROR: ' + error.message);
                      console.error('Database error:', error);
                    } else {
                      alert('SUCCESS! Connection created/updated: ' + JSON.stringify(data));
                      console.log('Success:', data);
                    }
                  });
              }}
              className="bg-blue-600 text-white hover:bg-blue-700 text-xl p-6"
              size="lg"
            >
              📅 CREATE CONNECTION 📅
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const isConnected = connectedIntegrations.has(integration.id);
          const currentStatus = isConnected ? 'connected' : integration.status;
          
          return (
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
                  <Badge variant={getStatusColor(currentStatus)} className="flex items-center gap-1">
                    {getStatusIcon(currentStatus)}
                    {currentStatus}
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
                 ) : isConnected ? (
                    <div className="space-y-2">
                      <Button 
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white border-0 hover:shadow-lg transition-all"
                        onClick={handleSyncCalendar}
                        disabled={isConnecting}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isConnecting ? 'animate-spin' : ''}`} />
                        {isConnecting ? 'Syncing...' : 'Sync Calendar'}
                      </Button>
                      <p className="text-xs text-center text-green-600">✓ Connected and ready to sync</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button 
                        className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all"
                        onClick={(e) => {
                          console.log('🔍 Button clicked for integration:', integration.id);
                          e.preventDefault();
                          handleConnect(integration.id);
                        }}
                        disabled={isConnecting && integration.id === 'google-calendar'}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        {isConnecting && integration.id === 'google-calendar' ? 'Connecting...' : 'Connect Now'}
                      </Button>
                      
                      {/* Quick connect button for users already signed in with Google */}
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          try {
                            // Try to create connection with current session
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user?.app_metadata?.providers?.includes('google')) {
                              console.log('🔍 User already has Google auth, attempting direct connection...');
                              const success = await createCalendarConnection(session);
                              if (success) {
                                setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
                                await refreshConnections();
                                toast({
                                  title: "Quick Connect Success",
                                  description: "Using your existing Google login for calendar access.",
                                });
                              } else {
                                toast({
                                  title: "Quick Connect Failed",
                                  description: "Please use the 'Connect Now' button above for full setup.",
                                  variant: "destructive",
                                });
                              }
                            } else {
                              toast({
                                title: "No Google Auth",
                                description: "Please use 'Connect Now' to authenticate with Google first.",
                                variant: "destructive",
                              });
                            }
                          } catch (error) {
                            console.error('Quick connect error:', error);
                          }
                        }}
                      >
                        Quick Connect (if already signed in with Google)
                      </Button>
                    </div>
                  )}

                {integration.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {integration.lastSync}
                  </p>
                )}
               </div>
             </CardContent>
           </Card>
           );
         })}
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