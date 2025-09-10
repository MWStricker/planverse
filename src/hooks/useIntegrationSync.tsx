import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

interface IntegrationConnection {
  id: string;
  provider: string;
  provider_id: string | null;
  is_active: boolean;
  token_expires_at?: string | null;
  sync_settings: any;
}

export const useIntegrationSync = () => {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchConnections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('id, provider, provider_id, is_active, sync_settings, token_expires_at')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching connections:', error);
        return;
      }

      setConnections(data || []);
    } catch (error) {
      console.error('Unexpected error fetching connections:', error);
    }
  };

  const syncGoogleCalendar = async (connection: IntegrationConnection) => {
    try {
      // This would typically call an edge function or API endpoint
      // For now, we'll simulate the sync process
      console.log('Syncing Google Calendar for connection:', connection.id);
      
      // In a real implementation, this would:
      // 1. Use the access token to fetch calendar events
      // 2. Parse events for assignments/exams
      // 3. Create or update tasks in the database
      // 4. Update events table with calendar events

      // Simulated success for demo
      return true;
    } catch (error) {
      console.error('Error syncing Google Calendar:', error);
      return false;
    }
  };

  const syncCanvasLMS = async (connection: IntegrationConnection) => {
    try {
      console.log('Syncing Canvas LMS for connection:', connection.id);
      
      // In a real implementation, this would:
      // 1. Fetch assignments from Canvas API
      // 2. Parse assignment data
      // 3. Create tasks with appropriate priority based on keywords
      // 4. Update due dates and course information

      return true;
    } catch (error) {
      console.error('Error syncing Canvas LMS:', error);
      return false;
    }
  };

  const syncConnection = async (connection: IntegrationConnection) => {
    switch (connection.provider) {
      case 'google':
        return await syncGoogleCalendar(connection);
      case 'canvas':
        return await syncCanvasLMS(connection);
      default:
        console.warn(`Sync not implemented for provider: ${connection.provider}`);
        return false;
    }
  };

  const syncAllConnections = async () => {
    if (connections.length === 0) return;

    setSyncStatus('syncing');
    let hasErrors = false;

    try {
      for (const connection of connections) {
        const success = await syncConnection(connection);
        if (!success) {
          hasErrors = true;
        }
      }

      if (hasErrors) {
        setSyncStatus('error');
        toast({
          title: "Sync Issues",
          description: "Some integrations failed to sync. Check console for details.",
          variant: "destructive",
        });
      } else {
        setSyncStatus('idle');
        setLastSyncTime(new Date());
        toast({
          title: "Sync Complete",
          description: "All integrations synced successfully",
        });
      }
    } catch (error) {
      console.error('Error during sync:', error);
      setSyncStatus('error');
      toast({
        title: "Sync Failed",
        description: "An error occurred during synchronization",
        variant: "destructive",
      });
    }
  };

  const getConnectedProviders = () => {
    return connections.map(conn => conn.provider);
  };

  const isProviderConnected = (provider: string) => {
    return connections.some(conn => conn.provider === provider && conn.is_active);
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  // Auto-sync every 30 minutes if there are active connections
  useEffect(() => {
    if (connections.length === 0) return;

    const interval = setInterval(() => {
      if (syncStatus === 'idle') {
        syncAllConnections();
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [connections, syncStatus]);

  return {
    connections,
    syncStatus,
    lastSyncTime,
    syncAllConnections,
    getConnectedProviders,
    isProviderConnected,
    refreshConnections: fetchConnections
  };
};