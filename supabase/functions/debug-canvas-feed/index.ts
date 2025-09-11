import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { connection_id } = await req.json();

    if (!connection_id) {
      return new Response(
        JSON.stringify({ error: 'Missing connection_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Debugging Canvas feed for connection:', connection_id);

    // Get the calendar connection
    const { data: connection, error: connectionError } = await supabaseClient
      .from('calendar_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('provider', 'canvas')
      .single();

    if (connectionError || !connection) {
      console.error('Connection not found:', connectionError);
      return new Response(
        JSON.stringify({ error: 'Calendar connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const feedUrl = connection.sync_settings?.feed_url;
    if (!feedUrl) {
      return new Response(
        JSON.stringify({ error: 'No feed URL configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Canvas feed from URL:', feedUrl);

    // Fetch the Canvas calendar feed
    const response = await fetch(feedUrl);
    if (!response.ok) {
      console.error('Failed to fetch Canvas feed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch Canvas feed: ${response.statusText}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const icsContent = await response.text();
    console.log('Fetched ICS content length:', icsContent.length);

    // Find all DESCRIPTION fields in the raw ICS content
    const descriptionMatches = icsContent.match(/DESCRIPTION[^:]*:.*$/gm) || [];
    const descriptions = descriptionMatches.map(match => {
      const colonIndex = match.indexOf(':');
      return match.substring(colonIndex + 1);
    });

    console.log('Found descriptions:', descriptions.length);
    descriptions.forEach((desc, index) => {
      console.log(`Description ${index + 1} (length: ${desc.length}): "${desc}"`);
    });

    // Look for assignments specifically
    const assignments = [];
    const events = icsContent.split('BEGIN:VEVENT');
    
    for (let i = 1; i < events.length; i++) {
      const event = events[i];
      const summaryMatch = event.match(/SUMMARY[^:]*:(.*)$/m);
      const descMatch = event.match(/DESCRIPTION[^:]*:(.*)$/m);
      
      if (summaryMatch) {
        assignments.push({
          title: summaryMatch[1].trim(),
          description: descMatch ? descMatch[1].trim() : 'No description',
          descriptionLength: descMatch ? descMatch[1].trim().length : 0
        });
      }
    }

    console.log('Parsed assignments:', assignments.length);

    return new Response(
      JSON.stringify({ 
        success: true,
        raw_content_sample: icsContent.substring(0, 2000),
        content_length: icsContent.length,
        description_count: descriptions.length,
        descriptions: descriptions,
        assignments: assignments,
        debug_info: {
          contains_vevent: icsContent.includes('VEVENT'),
          contains_description: icsContent.includes('DESCRIPTION'),
          first_assignment_sample: assignments[0] || null
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in debug-canvas-feed function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});