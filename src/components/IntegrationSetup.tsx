import { useState, useEffect } from "react";
import { Calendar, CheckCircle, ExternalLink, AlertTriangle, Zap, Lock, RefreshCw, X } from "lucide-react";
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
  
  console.log('🔍 IntegrationSetup component rendered');
  console.log('🔍 Current user:', !!user);

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
  }, []); // Remove dependency to fix infinite loop

  const createCalendarConnection = async (session: any) => {
    console.log('🔍 Creating calendar connection...');
    if (!user) {
      console.error('❌ No user available');
      return false;
    }

    try {
      console.log('🔍 Creating connection with session data...');
      console.log('🔍 Session provider_token:', session?.provider_token);
      console.log('🔍 Session provider_refresh_token:', session?.provider_refresh_token);
      
      const connectionData = {
        user_id: user.id,
        provider: 'google',
        provider_id: session?.user?.email || user.email || null,
        access_token: session?.provider_token || null,
        refresh_token: session?.provider_refresh_token || null,
        is_active: true,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
        token_expires_at: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        sync_settings: { 
          auto_sync: true, 
          last_sync: null,
          has_provider_token: !!session?.provider_token 
        },
      };

      console.log('🔍 Connection data:', {
        ...connectionData,
        access_token: connectionData.access_token ? '***present***' : 'missing',
        refresh_token: connectionData.refresh_token ? '***present***' : 'missing',
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
      console.log('🔍 Starting Google Calendar connection and sync...');
      
      // Always force re-authentication with calendar scopes to ensure we have the right permissions
      console.log('🔍 Starting OAuth flow with calendar scopes...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'email profile openid https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
          redirectTo: `${window.location.origin}/#integrations`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Always prompt for consent to get new scopes
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
          description: "Grant calendar permissions - your events will sync automatically when you return!",
        });
      }
    } catch (error) {
      console.error('❌ Error in handleGoogleCalendarConnect:', error);
      toast({
        title: "Connection Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Helper function to sync Google Calendar with real access token
  const syncGoogleCalendarNow = async (accessToken: string) => {
    try {
      console.log('🔄 Syncing real Google Calendar events...');
      
      // First create/update the calendar connection  
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const connectionResult = await createCalendarConnection(currentSession);
      if (!connectionResult) {
        throw new Error('Failed to create calendar connection');
      }

      // Get the connection ID
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .single();

      if (!connection) {
        throw new Error('No calendar connection found');
      }

      // Call sync function with real access token
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-google-calendar', {
        body: {
          connectionId: connection.id,
          accessToken: accessToken, // Use real Google access token
        },
      });

      if (syncError) {
        console.error('❌ Sync error:', syncError);
        return false;
      }

      if (syncData?.success) {
        console.log(`✅ Synced ${syncData.syncedEvents} real Google Calendar events!`);
        setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
        await refreshConnections();
        return true;
      } else {
        console.error('❌ Sync failed:', syncData?.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error in syncGoogleCalendarNow:', error);
      return false;
    }
  };

  const handleSyncCalendar = async () => {
    try {
      console.log('🔍 Starting REAL Google Calendar sync...');
      setIsConnecting(true);
      
      // Get current session with Google access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        throw new Error('No Google access token available. Please reconnect your Google account.');
      }
      
      // Get the calendar connection
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .single();

      if (!connection) {
        throw new Error('No Google Calendar connection found');
      }

      console.log('🔄 Calling sync with REAL Google access token...');
      
      // Call sync function with REAL Google access token
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-google-calendar', {
        body: {
          connectionId: connection.id,
          accessToken: session.provider_token, // REAL Google token!
        },
      });

      if (syncError) {
        throw new Error(`Sync error: ${syncError.message}`);
      }

      if (syncData?.success) {
        await refreshConnections();
        toast({
          title: "Real Calendar Synced!",
          description: `Successfully imported ${syncData.syncedEvents} events from your Google Calendar.`,
        });
        console.log(`✅ Synced ${syncData.syncedEvents} REAL Google Calendar events!`);
      } else {
        throw new Error(syncData?.error || 'Unknown sync error');
      }
    } catch (error) {
      console.error('❌ Error syncing real calendar:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar events. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGoogleCalendarSync = async () => {
    console.log('🔥 Sync Google Calendar button clicked!');
    console.log('🔥 User present:', !!user);
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to sync your Google Calendar.",
        variant: "destructive",
      });
      return;
    }

    console.log('🔥 Starting sync process...');
    setIsConnecting(true);

    try {
      // Check if user is already authenticated with Google
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.provider_token && session?.user?.app_metadata?.providers?.includes('google')) {
        console.log('🔍 User already authenticated with Google, proceeding to sync...');
        console.log('🔍 Session provider token present:', !!session.provider_token);
        
        toast({
          title: "Starting Sync",
          description: "Connecting to your Google Calendar...",
        });
        const success = await createCalendarConnection(session);
        if (!success) {
          throw new Error('Failed to create calendar connection');
        }

        // Get the connection ID
        const { data: connection } = await supabase
          .from('calendar_connections')
          .select('id')
          .eq('user_id', user.id)
          .eq('provider', 'google')
          .single();

        if (!connection) {
          throw new Error('Calendar connection not found');
        }

        // Sync the calendar
        const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-google-calendar', {
          body: {
            connectionId: connection.id,
            accessToken: session.provider_token,
          },
        });

        if (syncError) {
          throw new Error(`Sync error: ${syncError.message}`);
        }

        if (syncData?.success) {
          setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
          await refreshConnections();
          
          console.log('✅ Sync successful:', syncData);
          console.log('📊 Events synced:', syncData.syncedEvents);
          console.log('📋 Tasks synced:', syncData.syncedTasks);
          console.log('❌ Errors:', syncData.errors);
          toast({
            title: "Calendar Synced Successfully!",
            description: `Imported ${syncData.syncedEvents || 0} events from your Google Calendar. Check your calendar views to see the events!`,
          });
          
          // Refresh the page data to show new events
          window.location.reload();
        } else {
          throw new Error(syncData?.error || 'Unknown sync error');
        }
      } else {
        console.log('🔍 User not authenticated with Google, redirecting to sign in...');
        
        // Redirect to Google OAuth with calendar scopes
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            scopes: 'email profile openid https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
            redirectTo: `${window.location.origin}/#integrations`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent', // Force consent screen to get calendar permissions
              include_granted_scopes: 'true',
            },
          },
        });

        if (error) {
          throw new Error(`OAuth error: ${error.message}`);
        }

        toast({
          title: "Redirecting to Google",
          description: "Please sign in with Google to sync your calendar.",
        });
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar. Please try again.",
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
          <strong>Simplified Google Calendar sync!</strong> Just click "Sync Google Calendar" below. If you're not signed in with Google, you'll be redirected to sign in first, then your calendar will sync automatically.
        </AlertDescription>
      </Alert>

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
            
            <Button 
              onClick={async () => {
                console.log('🔥 SYNC BUTTON CLICKED!');
                
                if (!user) {
                  alert('ERROR: No user found!');
                  return;
                }
                
                try {
                  setIsConnecting(true);
                  
                  // First, create a test connection if it doesn't exist
                  const { data: existingConnection } = await supabase
                    .from('calendar_connections')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('provider', 'google')
                    .single();
                  
                  let connectionId = existingConnection?.id;
                  
                  if (!connectionId) {
                    // Create a test connection
                    const { data: newConnection, error: connectionError } = await supabase
                      .from('calendar_connections')
                      .insert({
                        user_id: user.id,
                        provider: 'google',
                        provider_id: user.email,
                        is_active: true,
                        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
                        sync_settings: { auto_sync: true, last_sync: null },
                      })
                      .select('id')
                      .single();
                    
                    if (connectionError) {
                      throw new Error(`Failed to create connection: ${connectionError.message}`);
                    }
                    
                    connectionId = newConnection.id;
                    console.log('✅ Created new connection:', connectionId);
                  }
                  
                  // Now sync with the connection
                  console.log('🔄 Calling sync edge function...');
                  const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-google-calendar', {
                    body: {
                      connectionId: connectionId,
                      accessToken: 'mock_token_for_testing', // This triggers mock data
                    },
                  });
                  
                  if (syncError) {
                    throw new Error(`Sync error: ${syncError.message}`);
                  }
                  
                  if (syncData?.success) {
                    setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
                    toast({
                      title: "Calendar Synced Successfully!",
                      description: `Imported ${syncData.syncedEvents} test events to your calendar.`,
                    });
                    console.log(`✅ Synced ${syncData.syncedEvents} events!`);
                  } else {
                    throw new Error(syncData?.error || 'Unknown sync error');
                  }
                } catch (error) {
                  console.error('❌ Sync error:', error);
                  toast({
                    title: "Sync Failed",
                    description: error.message || "Failed to sync calendar. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsConnecting(false);
                }
              }}
              className="bg-purple-600 text-white hover:bg-purple-700 text-xl p-6"
              size="lg"
              disabled={isConnecting}
            >
              {isConnecting ? '⏳ SYNCING...' : '🔄 SYNC CALENDAR NOW 🔄'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const isConnected = connectedIntegrations.has(integration.id);
          const currentStatus = isConnected ? 'connected' : integration.status;
          
          console.log('🔍 Rendering integration:', integration.id, 'requiresBackend:', integration.requiresBackend);
          
          return (
            <Card 
              key={integration.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedIntegration === integration.id ? 'ring-2 ring-primary' : ''
              } ${integration.requiresBackend ? 'opacity-75' : ''}`}
              onClick={() => {
                console.log('🔍 Integration card clicked:', integration.id);
                setSelectedIntegration(integration.id);
              }}
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
                  ) : (
                      <div className="space-y-2">
                        {currentStatus === 'connected' ? (
                          <>
                            <Button 
                              className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔥🔥🔥 SYNC BUTTON CLICKED! 🔥🔥🔥');
                                try {
                                  handleGoogleCalendarSync();
                                } catch (error) {
                                  console.error('🔥 Error in handleGoogleCalendarSync:', error);
                                }
                              }}
                              disabled={isConnecting}
                              type="button"
                            >
                              <RefreshCw className={`h-4 w-4 mr-2 ${isConnecting ? 'animate-spin' : ''}`} />
                              {isConnecting ? 'Syncing...' : 'Sync Calendar & Tasks'}
                            </Button>
                            <Button 
                              variant="outline"
                              className="w-full"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  // Sign out from Supabase to clear the Google session
                                  await supabase.auth.signOut();
                                  // Delete any stored calendar connections
                                  await supabase
                                    .from('calendar_connections')
                                    .delete()
                                    .eq('user_id', user?.id)
                                    .eq('provider', 'google');
                                  
                                  toast({
                                    title: "Disconnected",
                                    description: "Google Calendar connection removed. Click 'Connect & Sync' to re-authorize with Tasks access.",
                                  });
                                  
                                  // Refresh the page to update connection status
                                  window.location.reload();
                                } catch (error) {
                                  console.error('Error disconnecting:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to disconnect. Please try again.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              type="button"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Disconnect Google
                            </Button>
                          </>
                        ) : (
                          <Button 
                            className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('🔥🔥🔥 CONNECT BUTTON CLICKED! 🔥🔥🔥');
                              try {
                                handleGoogleCalendarSync();
                              } catch (error) {
                                console.error('🔥 Error in handleGoogleCalendarSync:', error);
                              }
                            }}
                            disabled={isConnecting}
                            type="button"
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isConnecting ? 'animate-spin' : ''}`} />
                            {isConnecting ? 'Connecting...' : 'Connect & Sync with Tasks'}
                          </Button>
                        )}
                        <p className="text-xs text-center text-muted-foreground">
                          {currentStatus === 'connected' 
                            ? 'Syncs both calendar events and tasks from Google'
                            : 'Will request both Calendar and Tasks permissions'
                          }
                        </p>
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