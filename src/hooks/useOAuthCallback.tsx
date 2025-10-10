import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export const useOAuthCallback = () => {
  const { toast } = useToast();
  const processedSignIns = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log('🎯 OAuth callback handler registered at app root');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔍 Auth state change:', event, {
        hasSession: !!session,
        hasProviderToken: !!session?.provider_token,
        hasRefreshToken: !!session?.provider_refresh_token,
        provider: session?.user?.app_metadata?.provider,
        userId: session?.user?.id,
        timestamp: new Date().toISOString()
      });

      // Only process SIGNED_IN events with provider tokens
      // CRITICAL: provider_token is ONLY available during SIGNED_IN event immediately after OAuth redirect
      if (event !== 'SIGNED_IN' || !session?.provider_token) {
        console.log('⏭️ Skipping auth event - either not SIGNED_IN or no provider_token available');
        return;
      }

      const provider = session.user.app_metadata?.provider;
      const userId = session.user.id;
      const signInKey = `${userId}-${provider}-${Date.now()}`;

      // Prevent duplicate processing with time-based deduplication
      if (processedSignIns.current.has(signInKey)) {
        console.log('⏭️ Already processed this sign-in, skipping...');
        return;
      }

      processedSignIns.current.add(signInKey);

      // Clean up old entries (keep only last 10)
      if (processedSignIns.current.size > 10) {
        const entries = Array.from(processedSignIns.current);
        processedSignIns.current = new Set(entries.slice(-10));
      }

      console.log(`✅ Processing OAuth callback for ${provider} - tokens available NOW`);

      // Handle Google Calendar OAuth
      if (provider === 'google') {
        console.log('🔍 Processing Google Calendar connection...');
        
        try {
          const connectionData = {
            user_id: userId,
            provider: 'google',
            provider_id: session.user.email || null,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || null,
            is_active: true,
            scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
            token_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
            sync_settings: { 
              auto_sync: true, 
              last_sync: null,
              has_provider_token: true
            },
          };

          const { error } = await supabase
            .from('calendar_connections')
            .upsert(connectionData, {
              onConflict: 'user_id,provider'
            });

          if (error) {
            console.error('❌ Database error creating connection:', error);
            toast({
              title: "Connection Failed",
              description: "Failed to store Google Calendar connection",
              variant: "destructive",
            });
          } else {
            console.log('✅ Google Calendar connection stored');
            toast({
              title: "Google Calendar Connected!",
              description: "Your calendar will sync automatically.",
            });
          }
        } catch (error) {
          console.error('❌ Error in Google Calendar connection:', error);
        }
      }

      // Handle Spotify OAuth
      if (provider === 'spotify') {
        console.log('🔍 Processing Spotify connection...');
        
        try {
          const { data, error } = await supabase.functions.invoke('store-spotify-connection', {
            body: {
              provider_token: session.provider_token,
              provider_refresh_token: session.provider_refresh_token,
              expires_at: session.expires_at,
              provider_id: session.user.id,
            },
          });

          if (error) {
            console.error('❌ Error storing Spotify connection:', error);
            toast({
              title: "Connection Failed",
              description: error.message || "Failed to store Spotify connection",
              variant: "destructive",
            });
          } else {
            console.log('✅ Spotify connection stored:', data);
            toast({
              title: "Spotify Connected!",
              description: "Your currently playing music will now appear on your profile.",
            });
          }
        } catch (error) {
          console.error('❌ Error in Spotify connection:', error);
        }
      }
    });

    return () => {
      console.log('🔌 OAuth callback handler unregistered');
      subscription.unsubscribe();
    };
  }, [toast]);
};
