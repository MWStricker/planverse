import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client to access auth.identities
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📍 User authenticated:', user.id);

    // Query auth.identities to find Spotify identity
    const { data: identities, error: identitiesError } = await supabaseAdmin
      .from('identities')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'spotify')
      .order('created_at', { ascending: false })
      .limit(1);

    if (identitiesError) {
      console.error('❌ Error querying identities:', identitiesError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve Spotify identity' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!identities || identities.length === 0) {
      console.log('⚠️ No Spotify identity found for user');
      return new Response(
        JSON.stringify({ error: 'No Spotify account linked. Please connect Spotify first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const spotifyIdentity = identities[0];
    console.log('✅ Found Spotify identity:', spotifyIdentity.id);

    // Extract provider tokens from identity_data
    const identityData = spotifyIdentity.identity_data as any;
    const providerToken = identityData?.provider_token;
    const providerRefreshToken = identityData?.provider_refresh_token;
    const expiresAt = identityData?.expires_at;
    const providerId = identityData?.provider_id || spotifyIdentity.id;

    if (!providerToken) {
      console.error('❌ No provider_token found in identity');
      return new Response(
        JSON.stringify({ error: 'Spotify tokens not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔑 Extracted tokens, encrypting...');

    // Encrypt access token
    const { data: accessTokenSecret, error: accessTokenError } = await supabaseAdmin.rpc(
      'vault.create_secret',
      {
        secret: providerToken,
        name: `spotify_access_${user.id}_${Date.now()}`
      }
    );

    if (accessTokenError) {
      console.error('❌ Error encrypting access token:', accessTokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to encrypt access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encrypt refresh token if available
    let refreshTokenSecret = null;
    if (providerRefreshToken) {
      const { data: refreshSecret, error: refreshTokenError } = await supabaseAdmin.rpc(
        'vault.create_secret',
        {
          secret: providerRefreshToken,
          name: `spotify_refresh_${user.id}_${Date.now()}`
        }
      );

      if (refreshTokenError) {
        console.error('⚠️ Error encrypting refresh token:', refreshTokenError);
      } else {
        refreshTokenSecret = refreshSecret;
      }
    }

    console.log('🔐 Tokens encrypted, storing connection...');

    // Store connection in calendar_connections
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('calendar_connections')
      .upsert({
        user_id: user.id,
        provider: 'spotify',
        provider_id: providerId,
        access_token_enc: accessTokenSecret,
        refresh_token_enc: refreshTokenSecret,
        token_expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
        is_active: true,
        sync_settings: {}
      }, {
        onConflict: 'user_id,provider',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (connectionError) {
      console.error('❌ Error storing connection:', connectionError);
      return new Response(
        JSON.stringify({ error: 'Failed to store connection' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Spotify connection stored successfully!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        connection,
        message: 'Spotify connected successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
