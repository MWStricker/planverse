import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, 
  ExternalLink, 
  Plus, 
  Trash2, 
  RotateCw, 
  CheckCircle, 
  AlertTriangle,
  Globe,
  BookOpen,
  Settings,
  Info
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  provider_id: string;
  is_active: boolean;
  sync_settings: any;
  created_at: string;
  updated_at: string;
}

export const CanvasIntegration = () => {
  const [canvasFeedUrl, setCanvasFeedUrl] = useState('');
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCalendarConnections = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching calendar connections:', error);
        setCalendarConnections([]);
      } else {
        setCalendarConnections(data || []);
      }
    } catch (error) {
      console.error('Error fetching calendar connections:', error);
      setCalendarConnections([]);
    }
  }, [user]);

  useEffect(() => {
    fetchCalendarConnections();
  }, [fetchCalendarConnections]);

  const addCanvasFeed = async () => {
    if (!canvasFeedUrl.trim() || !user) {
      toast({
        title: "Error",
        description: "Please enter a valid Canvas calendar feed URL",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingFeed(true);
      
      // Check for existing Canvas connections
      const { data: existingConnections, error: fetchError } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'canvas');

      if (fetchError) {
        console.error('Error checking existing connections:', fetchError);
      }

      // If there are existing Canvas connections, remove them and their data
      if (existingConnections && existingConnections.length > 0) {
        console.log('Removing existing Canvas connections and data...');
        
        // Delete all Canvas events for the user
        const { error: eventsDeleteError } = await supabase
          .from('events')
          .delete()
          .eq('user_id', user.id)
          .eq('source_provider', 'canvas');

        if (eventsDeleteError) {
          console.error('Error deleting Canvas events:', eventsDeleteError);
        }

        // Delete all Canvas tasks for the user
        const { error: tasksDeleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('user_id', user.id)
          .eq('source_provider', 'canvas');

        if (tasksDeleteError) {
          console.error('Error deleting Canvas tasks:', tasksDeleteError);
        }

        // Delete the old Canvas connections
        const { error: connectionsDeleteError } = await supabase
          .from('calendar_connections')
          .delete()
          .eq('user_id', user.id)
          .eq('provider', 'canvas');

        if (connectionsDeleteError) {
          console.error('Error deleting Canvas connections:', connectionsDeleteError);
        } else {
          toast({
            title: "Previous Canvas Feed Replaced",
            description: "Previous Canvas schedule has been removed and will be replaced with the new one",
          });
        }
      }

      // Validate URL format
      const url = canvasFeedUrl.trim();
      if (!url.startsWith('http') || !url.includes('calendar')) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid Canvas calendar feed URL",
          variant: "destructive",
        });
        return;
      }

      // Add the new Canvas connection
      const { data, error } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          provider: 'canvas',
          provider_id: url,
          is_active: true,
          sync_settings: {
            feed_url: url,
            auto_sync: true,
            sync_type: 'assignments'
          }
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding calendar feed:', error);
        toast({
          title: "Error",
          description: `Failed to add calendar feed: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Successfully added calendar feed:', data);
        toast({
          title: "Success",
          description: "Canvas calendar feed added successfully. Syncing events...",
        });
        setCanvasFeedUrl('');
        setShowAddForm(false);
        
        // Refresh calendar connections
        fetchCalendarConnections();
        
        // Trigger Canvas feed sync
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-canvas-feed', {
            body: { connection_id: data.id }
          });
          
          if (syncError) {
            console.error('Sync error:', syncError);
            toast({
              title: "Sync Warning",
              description: "Calendar feed added but sync failed. Events may not appear immediately.",
              variant: "destructive",
            });
          } else {
            console.log('Sync result:', syncData);
            toast({
              title: "Canvas Sync Complete",
              description: "Your Canvas assignments and events have been imported successfully!",
            });
            
            // Dispatch refresh event to update calendar
            window.dispatchEvent(new CustomEvent('dataRefresh'));
          }
        } catch (syncError) {
          console.error('Sync error:', syncError);
          toast({
            title: "Sync Warning", 
            description: "Calendar feed added but sync failed. Events may not appear immediately.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error in addCanvasFeed:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingFeed(false);
    }
  };

  const removeCanvasFeed = async (connectionId: string) => {
    if (!user) return;

    try {
      // Delete Canvas events and tasks
      await Promise.all([
        supabase.from('events').delete().eq('user_id', user.id).eq('source_provider', 'canvas'),
        supabase.from('tasks').delete().eq('user_id', user.id).eq('source_provider', 'canvas'),
        supabase.from('calendar_connections').delete().eq('id', connectionId)
      ]);

      toast({
        title: "Canvas Feed Removed",
        description: "Your Canvas calendar feed and all associated events have been removed.",
      });

      fetchCalendarConnections();
      window.dispatchEvent(new CustomEvent('dataRefresh'));
    } catch (error) {
      console.error('Error removing Canvas feed:', error);
      toast({
        title: "Error",
        description: "Failed to remove Canvas feed. Please try again.",
        variant: "destructive",
      });
    }
  };

  const syncCanvasFeed = async (connectionId: string) => {
    setIsSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-canvas-feed', {
        body: { connection_id: connectionId }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sync Complete",
        description: "Your Canvas calendar has been synced successfully!",
      });

      // Dispatch refresh event to update calendar
      window.dispatchEvent(new CustomEvent('dataRefresh'));
    } catch (error) {
      console.error('Error syncing Canvas feed:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync Canvas calendar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const canvasConnections = calendarConnections.filter(conn => conn.provider === 'canvas');

  return (
    <Card className="w-full border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Canvas LMS Integration
                <Badge variant="secondary" className="text-xs">
                  Auto-Sync Enabled
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Automatically sync your Canvas assignments and due dates
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {canvasConnections.length > 0 ? 'Replace Feed' : 'Add Canvas Feed'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Existing Connections */}
        {canvasConnections.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Connected Canvas Feeds</h4>
            {canvasConnections.map((connection) => (
              <div 
                key={connection.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Canvas Calendar Feed</p>
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(connection.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncCanvasFeed(connection.id)}
                    disabled={isSyncing}
                    className="gap-2"
                  >
                    <RotateCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeCanvasFeed(connection.id)}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Feed Form */}
        {showAddForm && (
          <div className="space-y-4 p-4 rounded-lg bg-card border border-border">
            <div className="space-y-2">
              <label htmlFor="canvasFeedUrl" className="text-sm font-medium">
                Canvas Calendar Feed URL
              </label>
              <Input
                id="canvasFeedUrl"
                type="url"
                value={canvasFeedUrl}
                onChange={(e) => setCanvasFeedUrl(e.target.value)}
                placeholder="https://[school].instructure.com/feeds/calendars/user_..."
                className="w-full"
                disabled={isAddingFeed}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={addCanvasFeed}
                disabled={isAddingFeed || !canvasFeedUrl.trim()}
                className="flex-1 gap-2"
              >
                {isAddingFeed ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    Adding Feed...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    Add Canvas Feed
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setCanvasFeedUrl('');
                }}
                disabled={isAddingFeed}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-foreground">How to find your Canvas Calendar Feed URL:</p>
              <ol className="text-sm space-y-1 ml-4 list-decimal">
                <li>Go to your Canvas Calendar</li>
                <li>Look for "Calendar Feed" in the right sidebar</li>
                <li>Click on it and copy the provided URL (ends with .ics)</li>
                <li>Paste it above and click "Add Canvas Feed"</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Your Canvas events will automatically sync and appear in your calendar with course-specific colors.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Automatic sync</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Assignment tracking</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Course colors</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Due date alerts</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
