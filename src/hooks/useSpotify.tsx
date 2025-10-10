import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NowPlaying {
  isPlaying: boolean;
  song: string;
  artist: string;
  album: string;
  albumArt: string;
  progress: number;
  duration: number;
  url: string;
}

export const useSpotify = (userId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    if (!userId) {
      setIsConnected(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'spotify')
        .eq('is_active', true)
        .maybeSingle();

      setIsConnected(!!data && !error);
    } catch (error) {
      console.error('Error checking Spotify connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchNowPlaying = useCallback(async () => {
    if (!userId || !isConnected) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('spotify-now-playing');

      if (error) {
        console.error('Error fetching now playing:', error);
        setNowPlaying(null);
        return;
      }

      if (data && data.isPlaying) {
        setNowPlaying(data);
      } else {
        setNowPlaying(null);
      }
    } catch (error) {
      console.error('Error invoking spotify-now-playing:', error);
      setNowPlaying(null);
    }
  }, [userId, isConnected]);

  const disconnect = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('calendar_connections')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('provider', 'spotify');

      if (error) throw error;

      setIsConnected(false);
      setNowPlaying(null);
    } catch (error) {
      console.error('Error disconnecting Spotify:', error);
      throw error;
    }
  }, [userId]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (!isConnected) return;

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, fetchNowPlaying]);

  return {
    isConnected,
    nowPlaying,
    loading,
    fetchNowPlaying,
    disconnect,
    checkConnection,
  };
};
