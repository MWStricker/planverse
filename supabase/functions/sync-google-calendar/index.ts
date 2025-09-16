import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { connectionId, accessToken } = await req.json();

    if (!connectionId) {
      throw new Error('Missing connectionId parameter');
    }

    console.log(`Starting Google Calendar sync for connection: ${connectionId}`);

    // For testing purposes, if no real access token, create sample Google Calendar events
    if (!accessToken || accessToken === 'mock_token_for_testing') {
      console.log('🧪 Creating sample Google Calendar events for testing...');
      
      const sampleEvents = [
        {
          id: 'sample_google_event_1',
          summary: 'Sample Google Calendar Event 1',
          description: 'This is a sample event from your Google Calendar',
          start: { dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString() },
          location: 'Sample Location'
        },
        {
          id: 'sample_google_event_2',
          summary: 'Sample Meeting from Google Calendar',
          description: 'Another sample event to demonstrate sync',
          start: { dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString() },
          location: 'Conference Room A'
        },
        {
          id: 'sample_google_event_3',
          summary: 'All-day Event from Google Calendar',
          description: 'Sample all-day event',
          start: { date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
          end: { date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }
        }
      ];
      
      const events = sampleEvents;
      console.log(`Using ${events.length} sample events for testing`);
    } else {
      // Real Google Calendar API call
      const calendarResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=250&singleEvents=true&orderBy=startTime',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text();
        console.error('Google Calendar API error:', errorText);
        throw new Error(`Failed to fetch calendar events: ${calendarResponse.status}`);
      }

      const calendarData = await calendarResponse.json();
      var events = calendarData.items || [];
      console.log(`Fetched ${events.length} events from Google Calendar API`);
    }

    console.log(`Fetched ${events.length} events from Google Calendar`);

    let syncedEvents = 0;
    let errors = 0;

    // Process each event
    for (const event of events) {
      try {
        // Skip events without proper time information
        if (!event.start || (!event.start.dateTime && !event.start.date)) {
          continue;
        }

        // Determine start and end times
        let startTime: string;
        let endTime: string;
        let isAllDay = false;

        if (event.start.date) {
          // All-day event
          isAllDay = true;
          startTime = new Date(event.start.date + 'T00:00:00Z').toISOString();
          endTime = event.end?.date 
            ? new Date(event.end.date + 'T23:59:59Z').toISOString()
            : new Date(event.start.date + 'T23:59:59Z').toISOString();
        } else {
          // Timed event
          startTime = new Date(event.start.dateTime).toISOString();
          endTime = event.end?.dateTime 
            ? new Date(event.end.dateTime).toISOString() 
            : new Date(new Date(event.start.dateTime).getTime() + 3600000).toISOString(); // Default 1 hour
        }

        // Check if event already exists
        const { data: existingEvent } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', user.id)
          .eq('source_provider', 'google')
          .eq('source_event_id', event.id)
          .single();

        const eventData = {
          user_id: user.id,
          title: event.summary || 'Untitled Event',
          description: event.description || null,
          start_time: startTime,
          end_time: endTime,
          is_all_day: isAllDay,
          location: event.location || null,
          source_provider: 'google',
          source_event_id: event.id,
          event_type: 'event',
          updated_at: new Date().toISOString(),
        };

        if (existingEvent) {
          // Update existing event
          const { error: updateError } = await supabase
            .from('events')
            .update(eventData)
            .eq('id', existingEvent.id);

          if (updateError) {
            console.error('Error updating event:', updateError);
            errors++;
          } else {
            syncedEvents++;
          }
        } else {
          // Create new event
          eventData.created_at = new Date().toISOString();
          
          const { error: insertError } = await supabase
            .from('events')
            .insert(eventData);

          if (insertError) {
            console.error('Error inserting event:', insertError);
            errors++;
          } else {
            syncedEvents++;
          }
        }
      } catch (eventError) {
        console.error('Error processing event:', eventError);
        errors++;
      }
    }

    // Update connection last sync time
    await supabase
      .from('calendar_connections')
      .update({ 
        updated_at: new Date().toISOString(),
        sync_settings: { last_sync: new Date().toISOString() }
      })
      .eq('id', connectionId);

    console.log(`Sync complete: ${syncedEvents} events synced, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedEvents,
        errors,
        totalEvents: events.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-google-calendar function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});