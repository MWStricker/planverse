import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type ConnectionStatus = 'online' | 'offline' | 'degraded';

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    // Monitor Supabase realtime connection
    const channel = supabase.channel('connection-monitor');
    
    channel.on('system', {}, (payload: any) => {
      console.log('Connection status:', payload);
      
      if (payload.status === 'SUBSCRIBED') {
        setStatus('online');
        setShowStatus(false);
      } else if (payload.status === 'CLOSED' || payload.status === 'TIMED_OUT') {
        setStatus('offline');
        setShowStatus(true);
      } else if (payload.status === 'CHANNEL_ERROR') {
        setStatus('degraded');
        setShowStatus(true);
      }
    });

    channel.subscribe();

    // Monitor browser online/offline
    const handleOnline = () => {
      setStatus('online');
      setShowStatus(false);
    };

    const handleOffline = () => {
      setStatus('offline');
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setStatus('offline');
      setShowStatus(true);
    }

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-hide after 5 seconds if back online
  useEffect(() => {
    if (status === 'online' && showStatus) {
      const timer = setTimeout(() => setShowStatus(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [status, showStatus]);

  if (!showStatus) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2">
      <Badge 
        variant={status === 'online' ? 'default' : status === 'degraded' ? 'secondary' : 'destructive'}
        className="px-4 py-2 text-sm shadow-lg"
      >
        {status === 'online' && (
          <>
            <Wifi className="h-4 w-4 mr-2" />
            Back Online
          </>
        )}
        {status === 'degraded' && (
          <>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Connection Issues
          </>
        )}
        {status === 'offline' && (
          <>
            <WifiOff className="h-4 w-4 mr-2" />
            You're Offline
          </>
        )}
      </Badge>
    </div>
  );
};
