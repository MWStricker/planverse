import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CalendarEvent {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  event_type: string;
  source_provider: string;
  source_event_id: string;
}

function parseICS(icsContent: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsContent.split('\n').map(line => line.trim());
  
  let currentEvent: Partial<CalendarEvent> = {};
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        source_provider: 'canvas',
        event_type: 'assignment'
      };
    } else if (line === 'END:VEVENT' && inEvent) {
      if (currentEvent.title && currentEvent.start_time) {
        // Set end time to start time if not specified
        if (!currentEvent.end_time) {
          currentEvent.end_time = currentEvent.start_time;
        }
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = {};
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.replace('SUMMARY:', '').replace(/\\n/g, ' ').replace(/\\,/g, ',');
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.replace('DESCRIPTION:', '').replace(/\\n/g, '\n').replace(/\\,/g, ',');
      } else if (line.startsWith('DTSTART:')) {
        const dateStr = line.replace('DTSTART:', '');
        currentEvent.start_time = parseICSDate(dateStr);
      } else if (line.startsWith('DTEND:')) {
        const dateStr = line.replace('DTEND:', '');
        currentEvent.end_time = parseICSDate(dateStr);
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.replace('LOCATION:', '').replace(/\\,/g, ',');
      } else if (line.startsWith('UID:')) {
        currentEvent.source_event_id = line.replace('UID:', '');
      }
    }
  }
  
  return events;
}

function parseICSDate(dateStr: string): string {
  // Handle different date formats from ICS
  if (dateStr.includes('T')) {
    // DateTime format: 20241201T140000Z or 20241201T140000
    const cleanDate = dateStr.replace(/[TZ]/g, '');
    const year = cleanDate.substr(0, 4);
    const month = cleanDate.substr(4, 2);
    const day = cleanDate.substr(6, 2);
    const hour = cleanDate.substr(8, 2) || '00';
    const minute = cleanDate.substr(10, 2) || '00';
    const second = cleanDate.substr(12, 2) || '00';
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  } else {
    // Date only format: 20241201
    const year = dateStr.substr(0, 4);
    const month = dateStr.substr(4, 2);
    const day = dateStr.substr(6, 2);
    
    return `${year}-${month}-${day}T00:00:00Z`;
  }
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

    console.log('Syncing Canvas feed for connection:', connection_id);

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
      console.error('No feed URL found in connection');
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

    // Parse the ICS content
    const events = parseICS(icsContent);
    console.log('Parsed events count:', events.length);

    if (events.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No events found in Canvas feed',
          events_processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete existing events from this Canvas connection to avoid duplicates
    const { error: deleteError } = await supabaseClient
      .from('events')
      .delete()
      .eq('user_id', connection.user_id)
      .eq('source_provider', 'canvas');

    if (deleteError) {
      console.error('Error deleting existing Canvas events:', deleteError);
    }

    // Insert new events
    const eventsToInsert = events.map(event => ({
      ...event,
      user_id: connection.user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: insertedEvents, error: insertError } = await supabaseClient
      .from('events')
      .insert(eventsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting events:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to save events: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully inserted events:', insertedEvents?.length || 0);

    // Update the connection's last sync time
    await supabaseClient
      .from('calendar_connections')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', connection_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${insertedEvents?.length || 0} events from Canvas`,
        events_processed: insertedEvents?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-canvas-feed function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});