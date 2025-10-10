import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const spotifyClientId = Deno.env.get('SPOTIFY_CLIENT_ID')!;
    const spotifyClientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch Spotify connection
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'spotify')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      console.log('No Spotify connection found');
      return new Response(
        JSON.stringify({ error: 'No Spotify connection found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    let accessToken = connection.access_token_enc?.toString();

    // Check if token is expired and refresh if needed
    const tokenExpiresAt = new Date(connection.token_expires_at);
    if (tokenExpiresAt <= new Date()) {
      console.log('Token expired, refreshing...');
      
      const refreshToken = connection.refresh_token_enc?.toString();
      const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${spotifyClientId}:${spotifyClientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh Spotify token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update connection with new token
      await supabase
        .from('calendar_connections')
        .update({
          access_token_enc: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('id', connection.id);

      console.log('Token refreshed successfully');
    }

    // Fetch currently playing track
    const spotifyResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (spotifyResponse.status === 204 || !spotifyResponse.ok) {
      console.log('No track currently playing');
      return new Response(
        JSON.stringify({ isPlaying: false, message: 'No track currently playing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await spotifyResponse.json();

    if (!data.item) {
      return new Response(
        JSON.stringify({ isPlaying: false, message: 'No track data available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trackData = {
      isPlaying: data.is_playing,
      song: data.item.name,
      artist: data.item.artists.map((a: any) => a.name).join(', '),
      album: data.item.album.name,
      albumArt: data.item.album.images[0]?.url,
      progress: data.progress_ms,
      duration: data.item.duration_ms,
      url: data.item.external_urls.spotify,
    };

    console.log('Successfully fetched now playing:', trackData.song);

    return new Response(
      JSON.stringify(trackData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in spotify-now-playing:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
