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
      console.log('🔍 Full session object:', JSON.stringify({
        provider_token: session.provider_token ? 'EXISTS' : 'NULL',
        provider_refresh_token: session.provider_refresh_token ? 'EXISTS' : 'NULL',
        expires_at: session.expires_at,
        provider: provider,
        user_id: userId,
        email: session.user.email
      }, null, 2));

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
      } else if (provider === 'spotify') {
        console.log('🎵 Processing Spotify connection via edge function...');
        console.log('🔍 Provider tokens in session:', {
          has_provider_token: !!session.provider_token,
          has_refresh_token: !!session.provider_refresh_token
        });
        
        try {
          // Call the edge function to link Spotify account
          const { data, error } = await supabase.functions.invoke('link-spotify-connection');
          
          if (error) {
            console.error('❌ Error linking Spotify:', error);
            toast({
              title: "Spotify Connection Failed",
              description: error.message || "Failed to link Spotify account",
              variant: "destructive",
            });
          } else if (data?.success) {
            console.log('✅ Spotify connection successful');
            toast({
              title: "Spotify Connected!",
              description: "Your Spotify account has been linked.",
            });
          } else {
            console.warn('⚠️ Unexpected response from Spotify link:', data);
          }
        } catch (error) {
          console.error('❌ Error in Spotify connection:', error);
          toast({
            title: "Connection Error",
            description: "An unexpected error occurred while linking Spotify",
            variant: "destructive",
          });
        }
      }
    });

    return () => {
      console.log('🔌 OAuth callback handler unregistered');
      subscription.unsubscribe();
    };
  }, [toast]);
};
