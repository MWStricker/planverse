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
  status: 'connected' | 'disconnected' | 'error' | 'coming_soon';
  lastSync?: string;
  features: string[];
  requiresBackend: boolean;
}

const integrations: Integration[] = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync your Google Calendar events and assignments',
    icon: '📅',
    status: 'disconnected',
    features: ['Event sync', 'Two-way sync', 'Real-time updates'],
    requiresBackend: true,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Show what you\'re listening to on your profile',
    icon: '🎵',
    status: 'disconnected',
    features: ['Now playing display', 'Real-time updates', 'Profile integration'],
    requiresBackend: false,
  },
  {
    id: 'apple_calendar',
    name: 'Apple Calendar',
    description: 'Connect your Apple Calendar',
    icon: '🍎',
    status: 'coming_soon',
    features: ['Event sync', 'Reminders', 'Multiple calendars'],
    requiresBackend: false,
  },
  {
    id: 'canvas_lms',
    name: 'Canvas LMS',
    description: 'Automatically import assignments and deadlines',
    icon: '🎓',
    status: 'coming_soon',
    features: ['Assignment sync', 'Grade tracking', 'Due date reminders'],
    requiresBackend: true,
  },
  {
    id: 'blackboard',
    name: 'Blackboard',
    description: 'Import your Blackboard assignments',
    icon: '📚',
    status: 'coming_soon',
    features: ['Assignment import', 'Deadline tracking'],
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
          const provider = session?.user?.app_metadata?.provider;
          
          console.log('🔍 Post-OAuth session:', {
            hasSession: !!session,
            hasProviderToken: !!session?.provider_token,
            tokenLength: session?.provider_token?.length || 0,
            provider
          });
          
          if (session?.provider_token) {
            console.log(`✅ Found provider token for ${provider}, creating connection...`);
            
            // Route to appropriate connection handler based on provider
            if (provider === 'google') {
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
            } else if (provider === 'spotify') {
              const success = await createSpotifyConnection(session);
              if (success) {
                setConnectedIntegrations(prev => new Set([...prev, 'spotify']));
                
                toast({
                  title: "Spotify Connected!",
                  description: "Your currently playing music will now appear on your profile.",
                });
              }
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
        hasProviderToken: !!session?.provider_token,
        provider: session?.user?.app_metadata?.provider
      });
      
      // Auto-create connection and sync when user signs in with Google
      if (event === 'SIGNED_IN' && session?.provider_token && session?.user?.app_metadata?.provider === 'google' && user) {
        console.log('🔍 User signed in with Google, auto-creating connection...');
        
        setTimeout(async () => {
          const success = await createCalendarConnection(session);
          if (success) {
            setConnectedIntegrations(prev => new Set([...prev, 'google-calendar']));
            await refreshConnections();
            
            toast({
              title: "Google Calendar Connected!",
              description: "Starting automatic sync of your calendar and tasks...",
            });
            
            setTimeout(async () => {
              await handleSyncCalendar();
            }, 2000);
          }
        }, 1000);
      }
      
      // Auto-create connection when user signs in with Spotify
      if (event === 'SIGNED_IN' && session?.provider_token && session?.user?.app_metadata?.provider === 'spotify' && user) {
        console.log('🔍 User signed in with Spotify, auto-creating connection...');
        
        setTimeout(async () => {
          const success = await createSpotifyConnection(session);
          if (success) {
            setConnectedIntegrations(prev => new Set([...prev, 'spotify']));
            
            toast({
              title: "Spotify Connected!",
              description: "Your currently playing music will now appear on your profile.",
            });
          }
        }, 1000);
      }
    });

    return () => subscription.unsubscribe();
  }, [user]);

  // Update integration status based on connections
  useEffect(() => {
    const updateIntegrationStatus = () => {
      const connected = new Set<string>();
      if (isProviderConnected('google')) {
        connected.add('google_calendar');
      }
      if (isProviderConnected('spotify')) {
        connected.add('spotify');
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

  const createSpotifyConnection = async (session: any) => {
    console.log('🔍 Creating Spotify connection...');
    if (!user) {
      console.error('❌ No user available');
      return false;
    }

    try {
      console.log('🔍 Storing Spotify connection with encrypted tokens');

      // Call edge function to securely store encrypted tokens in vault
      const { data, error } = await supabase.functions.invoke('store-spotify-connection', {
        body: {
          provider_token: session?.provider_token,
          provider_refresh_token: session?.provider_refresh_token,
          expires_at: session?.expires_at,
          provider_id: session?.user?.id,
        },
      });

      if (error) {
        console.error('❌ Error storing Spotify connection:', error);
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to store Spotify connection",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Spotify connection created/updated:', data);
      return true;
    } catch (error) {
      console.error('❌ Error in createSpotifyConnection:', error);
      return false;
    }
  };

  const handleGoogleCalendarConnect = async () => {
    try {
      setIsConnecting(true);
      console.log('🔍 Starting Google Calendar connection and sync...');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'email profile openid https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
          redirectTo: `${window.location.origin}/#integrations`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
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

  const handleSpotifyConnect = async () => {
    try {
      setIsConnecting(true);
      const redirectUrl = `${window.location.origin}/#integrations`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: {
          scopes: 'user-read-currently-playing user-read-playback-state',
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
      toast({ title: "Redirecting to Spotify..." });
    } catch (error) {
      console.error('Error connecting to Spotify:', error);
      toast({
        title: "Connection failed",
        description: "Failed to connect to Spotify",
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
      // Check if user has valid Google authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Check for authentication errors or missing/expired tokens
      if (sessionError || !session?.provider_token || !session?.user?.app_metadata?.providers?.includes('google')) {
        console.log('🔍 Authentication issue detected, redirecting to Google...');
        console.log('Session error:', sessionError);
        console.log('Has provider token:', !!session?.provider_token);
        console.log('Has Google provider:', session?.user?.app_metadata?.providers?.includes('google'));
        
        // Clear any invalid session data and re-authenticate
        toast({
          title: "Reconnecting to Google",
          description: "Your Google authentication has expired. Redirecting to re-authenticate...",
        });

        // Sign out and re-authenticate with Google
        await supabase.auth.signOut();
        
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            scopes: 'email profile openid https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
            redirectTo: `${window.location.origin}/#integrations`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
              include_granted_scopes: 'true',
            },
          },
        });

        if (error) {
          throw new Error(`OAuth error: ${error.message}`);
        }
        return;
      }

      console.log('🔍 Valid Google authentication found, proceeding to sync...');
      
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
        // If sync fails due to token issues, try re-authentication
        if (syncError.message?.includes('403') || syncError.message?.includes('token') || syncError.message?.includes('auth')) {
          console.log('🔍 Token-related sync error, redirecting to re-authenticate...');
          toast({
            title: "Re-authentication Required",
            description: "Your Google permissions need to be renewed. Redirecting...",
          });
          
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              scopes: 'email profile openid https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
              redirectTo: `${window.location.origin}/#integrations`,
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
                include_granted_scopes: 'true',
              },
            },
          });
          return;
        }
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

  const handleSpotifyDisconnect = async () => {
    try {
      await supabase
        .from('calendar_connections')
        .delete()
        .eq('user_id', user?.id)
        .eq('provider', 'spotify');
      
      setConnectedIntegrations(prev => {
        const newSet = new Set(prev);
        newSet.delete('spotify');
        return newSet;
      });
      
      toast({
        title: "Disconnected",
        description: "Spotify has been disconnected from your profile.",
      });
    } catch (error) {
      console.error('Error disconnecting Spotify:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Spotify.",
        variant: "destructive",
      });
    }
  };

  const handleConnect = (integrationId: string) => {
    console.log('🔍 handleConnect called with:', integrationId);
    
    if (integrationId === 'google_calendar') {
      console.log('🔍 Calling handleGoogleCalendarConnect...');
      handleGoogleCalendarConnect();
    } else if (integrationId === 'spotify') {
      console.log('🔍 Calling handleSpotifyConnect...');
      handleSpotifyConnect();
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
                  ) : integration.id === 'spotify' ? (
                    // Spotify-specific buttons
                    <div className="space-y-2">
                      {currentStatus === 'connected' ? (
                        <Button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSpotifyDisconnect();
                          }} 
                          variant="outline" 
                          className="w-full"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Disconnect Spotify
                        </Button>
                      ) : (
                        <Button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSpotifyConnect();
                          }} 
                          className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all"
                          disabled={isConnecting}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {isConnecting ? 'Connecting...' : 'Connect Spotify'}
                        </Button>
                      )}
                    </div>
                  ) : integration.id === 'google_calendar' ? (
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
                   ) : null}

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