import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get the user from the auth token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { provider_token, provider_refresh_token, expires_at, provider_id } = await req.json();

    console.log('📥 Storing Spotify connection for user:', user.id);

    // Use Supabase's encryption to store the tokens
    // We'll use the vault.secrets table for encryption
    const { data: encryptedAccess, error: encryptError1 } = await supabase.rpc(
      'vault.create_secret',
      {
        secret: provider_token,
        name: `spotify_access_${user.id}`,
      }
    );

    if (encryptError1) {
      console.error('Error encrypting access token:', encryptError1);
      throw encryptError1;
    }

    const { data: encryptedRefresh, error: encryptError2 } = await supabase.rpc(
      'vault.create_secret',
      {
        secret: provider_refresh_token,
        name: `spotify_refresh_${user.id}`,
      }
    );

    if (encryptError2) {
      console.error('Error encrypting refresh token:', encryptError2);
      throw encryptError2;
    }

    // Store the connection with encrypted token references
    const { data: connection, error: dbError } = await supabase
      .from('calendar_connections')
      .upsert({
        user_id: user.id,
        provider: 'spotify',
        provider_id: provider_id,
        is_active: true,
        scope: 'user-read-currently-playing user-read-playback-state',
        token_expires_at: expires_at ? new Date(expires_at * 1000).toISOString() : null,
        sync_settings: {
          vault_access_key: `spotify_access_${user.id}`,
          vault_refresh_key: `spotify_refresh_${user.id}`,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log('✅ Spotify connection stored successfully');

    return new Response(
      JSON.stringify({ success: true, connection }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in store-spotify-connection:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
