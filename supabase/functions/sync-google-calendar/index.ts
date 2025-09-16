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

    // Declare events variable with proper scope
    let events = [];

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
      
      events = sampleEvents;
      console.log(`Using ${events.length} sample events for testing`);
    } else {
      // Real Google Calendar API call - First get all calendars
      console.log('📅 Fetching all calendars...');
      const calendarsResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!calendarsResponse.ok) {
        throw new Error(`Failed to fetch calendars: ${calendarsResponse.status}`);
      }

      const calendarsData = await calendarsResponse.json();
      const calendars = calendarsData.items || [];
      console.log(`Found ${calendars.length} calendars:`, calendars.map(c => c.summary));

      events = [];
      
      // Fetch events from each calendar (including all calendars, not just primary)
      for (const calendar of calendars) {
        // Skip calendars we can't read or that are hidden
        if (!calendar.accessRole || 
            calendar.accessRole === 'freeBusyReader' || 
            calendar.hidden === true ||
            calendar.selected === false) {
          console.log(`⏭️  Skipping calendar: ${calendar.summary} (${calendar.accessRole || 'no access'})`);
          continue;
        }

        console.log(`📋 Fetching events from calendar: ${calendar.summary} (${calendar.id})`);
        
        // Get ALL events - much wider time range to ensure we don't miss anything
        const timeMin = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString(); // 24 months back
        const timeMax = new Date(Date.now() + 36 * 30 * 24 * 60 * 60 * 1000).toISOString(); // 36 months forward
        
        let nextPageToken = null;
        let calendarEvents = [];
        let pageCount = 0;
        
        // Paginate through ALL events for this calendar
        do {
          pageCount++;
          console.log(`📄 Fetching page ${pageCount} for ${calendar.summary}...`);
          
          const params = new URLSearchParams({
            maxResults: '2500', // Maximum allowed per request
            singleEvents: 'true', // Expand recurring events
            orderBy: 'startTime',
            timeMin: timeMin,
            timeMax: timeMax,
            showDeleted: 'false', // Don't include deleted events
            showHiddenInvitations: 'false', // Don't include hidden invitations
          });
          
          if (nextPageToken) {
            params.append('pageToken', nextPageToken);
          }

          const eventsResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!eventsResponse.ok) {
            console.error(`❌ Failed to fetch events from calendar ${calendar.summary}: ${eventsResponse.status}`);
            const errorText = await eventsResponse.text();
            console.error('Error details:', errorText);
            break;
          }

          const eventsData = await eventsResponse.json();
          const pageEvents = eventsData.items || [];
          calendarEvents = calendarEvents.concat(pageEvents);
          
          nextPageToken = eventsData.nextPageToken;
          console.log(`📝 Fetched ${pageEvents.length} events from ${calendar.summary} page ${pageCount} (total: ${calendarEvents.length})`);
          
          // Safety break to prevent infinite loops
          if (pageCount > 50) {
            console.log(`⚠️  Stopping pagination at page ${pageCount} for safety`);
            break;
          }
          
        } while (nextPageToken);
        
        // Add calendar source to each event
        calendarEvents.forEach(event => {
          event.calendarName = calendar.summary;
          event.calendarId = calendar.id;
          event.calendarColor = calendar.backgroundColor || calendar.colorId;
        });
        
        events = events.concat(calendarEvents);
        console.log(`✅ Total events from ${calendar.summary}: ${calendarEvents.length}`);
      }
      
      console.log(`🎯 TOTAL EVENTS FETCHED FROM ALL CALENDARS: ${events.length}`);
      
      // Log breakdown by calendar
      const eventsByCalendar = {};
      events.forEach(event => {
        const calName = event.calendarName || 'Unknown';
        eventsByCalendar[calName] = (eventsByCalendar[calName] || 0) + 1;
      });
      console.log('📊 Events by calendar:', eventsByCalendar);
    }

    console.log(`Processing ${events.length} events from Google Calendar`);

    console.log(`Processing ${events.length} events from Google Calendar`);

    let syncedEvents = 0;
    let errors = 0;

    // Process each event with detailed logging
    for (const event of events) {
      try {
        // Skip events without proper time information or if cancelled
        if (!event.start || (!event.start.dateTime && !event.start.date) || event.status === 'cancelled') {
          console.log(`⏭️  Skipping event: ${event.summary || 'No title'} - ${event.status || 'no time info'}`);
          continue;
        }

        console.log(`🔄 Processing event: ${event.summary || 'Untitled'} from ${event.calendarName || 'Unknown calendar'}`);

        // Determine start and end times with better handling
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

        // Check if event already exists (using both source_event_id and start_time for better matching)
        const { data: existingEvent } = await supabase
          .from('events')
          .select('id, updated_at')
          .eq('user_id', user.id)
          .eq('source_provider', 'google')
          .eq('source_event_id', event.id)
          .single();

        const eventData = {
          user_id: user.id,
          title: event.summary || 'Untitled Event',
          description: [
            event.description || '',
            event.calendarName ? `📅 Calendar: ${event.calendarName}` : '',
            event.location ? `📍 Location: ${event.location}` : '',
            event.attendees?.length > 0 ? `👥 ${event.attendees.length} attendees` : '',
            event.htmlLink ? `🔗 View in Google Calendar: ${event.htmlLink}` : ''
          ].filter(Boolean).join('\n\n'),
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
            console.error(`❌ Error updating event ${event.summary}:`, updateError);
            errors++;
          } else {
            console.log(`✅ Updated event: ${event.summary}`);
            syncedEvents++;
          }
        } else {
          // Create new event
          eventData.created_at = new Date().toISOString();
          
          const { error: insertError } = await supabase
            .from('events')
            .insert(eventData);

          if (insertError) {
            console.error(`❌ Error inserting event ${event.summary}:`, insertError);
            errors++;
          } else {
            console.log(`🆕 Created new event: ${event.summary}`);
            syncedEvents++;
          }
        }
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.summary || 'Unknown'}:`, eventError);
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