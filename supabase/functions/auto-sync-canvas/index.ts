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
  const lines = icsContent.split(/\r?\n/).map(line => line.trim());
  
  let currentEvent: Partial<CalendarEvent> = {};
  let inEvent = false;
  let multiLineProperty = '';
  let multiLineValue = '';
  
  console.log(`Parsing ICS with ${lines.length} lines`);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line continuations (lines starting with space or tab)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      multiLineValue += line.substring(1);
      continue;
    } else if (multiLineProperty && multiLineValue) {
      // Process the completed multi-line property
      processProperty(multiLineProperty, multiLineValue, currentEvent);
      multiLineProperty = '';
      multiLineValue = '';
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        source_provider: 'canvas',
        event_type: 'assignment'
      };
    } else if (line === 'END:VEVENT' && inEvent) {
      if (currentEvent.title) {
        // If no start_time, use current date
        if (!currentEvent.start_time) {
          currentEvent.start_time = new Date().toISOString();
        }
        // Set end time to start time if not specified
        if (!currentEvent.end_time) {
          currentEvent.end_time = currentEvent.start_time;
        }
        // Generate a UID if missing
        if (!currentEvent.source_event_id) {
          currentEvent.source_event_id = `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        events.push(currentEvent as CalendarEvent);
        console.log(`Added event: "${currentEvent.title}" at ${currentEvent.start_time}`);
      }
      currentEvent = {};
      inEvent = false;
    } else if (inEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const property = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      
      // Check if this might be a multi-line property
      if (value && !line.endsWith('\\')) {
        processProperty(property, value, currentEvent);
      } else {
        multiLineProperty = property;
        multiLineValue = value;
      }
    }
  }
  
  console.log(`Parsed ${events.length} events from ICS`);
  return events;
}

function processProperty(property: string, value: string, currentEvent: Partial<CalendarEvent>) {
  const cleanValue = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  
  if (property.startsWith('SUMMARY')) {
    currentEvent.title = cleanValue;
  } else if (property.startsWith('DESCRIPTION')) {
    currentEvent.description = cleanValue;
  } else if (property.startsWith('DTSTART')) {
    currentEvent.start_time = parseICSDate(value);
  } else if (property.startsWith('DTEND')) {
    currentEvent.end_time = parseICSDate(value);
  } else if (property.startsWith('DUE')) {
    // Canvas often uses DUE instead of DTSTART for assignments
    if (!currentEvent.start_time) {
      currentEvent.start_time = parseICSDate(value);
    }
    currentEvent.end_time = parseICSDate(value);
  } else if (property.startsWith('LOCATION')) {
    currentEvent.location = cleanValue;
  } else if (property.startsWith('UID')) {
    currentEvent.source_event_id = cleanValue;
  } else if (property.startsWith('CATEGORIES')) {
    // Canvas sometimes includes course info in categories
    if (cleanValue && !currentEvent.description) {
      currentEvent.description = `Course: ${cleanValue}`;
    }
  }
}

function parseICSDate(dateStr: string): string {
  console.log(`Parsing date: ${dateStr}`);
  
  try {
    // Extract timezone info if present
    let timezone = null;
    let cleanDateStr = dateStr;
    
    // Handle TZID parameter
    if (dateStr.includes('TZID=')) {
      const tzidMatch = dateStr.match(/TZID=([^:]+):/);
      if (tzidMatch) {
        timezone = tzidMatch[1];
        cleanDateStr = dateStr.split(':').slice(1).join(':');
        console.log(`Detected timezone: ${timezone}`);
      }
    } else if (dateStr.includes(':')) {
      // Remove any other parameters
      cleanDateStr = dateStr.split(':').slice(-1)[0];
    }
    
    // Handle different date formats from ICS
    if (cleanDateStr.includes('T')) {
      // DateTime format: 20241201T140000Z, 20241201T235900, etc.
      const isUTC = cleanDateStr.endsWith('Z');
      let datePart = cleanDateStr.replace(/[TZ]/g, '');
      
      if (datePart.length >= 8) {
        const year = datePart.substr(0, 4);
        const month = datePart.substr(4, 2);
        const day = datePart.substr(6, 2);
        
        // Extract time components - preserve exact times
        let hour = '23';
        let minute = '59';
        let second = '59';
        
        if (datePart.length >= 10) {
          hour = datePart.substr(8, 2);
        }
        if (datePart.length >= 12) {
          minute = datePart.substr(10, 2);
        }
        if (datePart.length >= 14) {
          second = datePart.substr(12, 2);
        }
        
        // Construct the ISO date string
        let result = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        
        // Handle timezone conversion
        if (isUTC) {
          result += 'Z';
        } else if (timezone) {
          // For common Canvas timezones, convert to proper offset
          const timezoneOffsets: { [key: string]: string } = {
            'America/New_York': '-05:00',
            'America/Chicago': '-06:00', 
            'America/Denver': '-07:00',
            'America/Los_Angeles': '-08:00',
            'America/Phoenix': '-07:00',
            'US/Eastern': '-05:00',
            'US/Central': '-06:00',
            'US/Mountain': '-07:00',
            'US/Pacific': '-08:00',
          };
          
          const offset = timezoneOffsets[timezone];
          if (offset) {
            result += offset;
          } else {
            // Default to UTC if timezone not recognized
            result += 'Z';
          }
          console.log(`Applied timezone offset for ${timezone}: ${offset || 'UTC'}`);
        } else {
          // No timezone specified, assume local time and convert to UTC
          const localDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
          result = localDate.toISOString();
        }
        
        console.log(`Parsed datetime: ${result} (original: ${dateStr})`);
        return result;
      }
    } else if (cleanDateStr.length >= 8) {
      // Date only format: 20241201
      const year = cleanDateStr.substr(0, 4);
      const month = cleanDateStr.substr(4, 2);
      const day = cleanDateStr.substr(6, 2);
      
      // For date-only events, use end of day (11:59:59 PM)
      const result = `${year}-${month}-${day}T23:59:59Z`;
      console.log(`Parsed date-only: ${result} (original: ${dateStr})`);
      return result;
    }
    
    // Fallback: try to parse as regular date string
    const date = new Date(cleanDateStr);
    if (!isNaN(date.getTime())) {
      const result = date.toISOString();
      console.log(`Parsed fallback date: ${result} (original: ${dateStr})`);
      return result;
    }
  } catch (error) {
    console.error(`Error parsing date ${dateStr}:`, error);
  }
  
  // Ultimate fallback: use current date at end of day
  const fallback = new Date();
  fallback.setHours(23, 59, 59, 999);
  const result = fallback.toISOString();
  console.log(`Using fallback date: ${result} (original: ${dateStr})`);
  return result;
}

async function syncCanvasConnection(supabaseClient: any, connection: any) {
  const feedUrl = connection.sync_settings?.feed_url;
  if (!feedUrl) {
    console.log(`Skipping connection ${connection.id} - no feed URL`);
    return { success: false, reason: 'No feed URL' };
  }

  console.log(`Syncing Canvas feed for connection ${connection.id}: ${feedUrl}`);

  try {
    // Fetch the Canvas calendar feed
    const response = await fetch(feedUrl);
    if (!response.ok) {
      console.error(`Failed to fetch Canvas feed for connection ${connection.id}:`, response.status);
      return { success: false, reason: `HTTP ${response.status}` };
    }

    const icsContent = await response.text();
    console.log(`Fetched ICS content length: ${icsContent.length} for connection ${connection.id}`);

    // Parse the ICS content
    const events = parseICS(icsContent);
    console.log(`Parsed ${events.length} events for connection ${connection.id}`);

    if (events.length === 0) {
      console.log(`No events found for connection ${connection.id}`);
      return { success: true, events_processed: 0 };
    }

    // Get existing events for comparison
    const { data: existingEvents } = await supabaseClient
      .from('events')
      .select('source_event_id, start_time, end_time, title')
      .eq('user_id', connection.user_id)
      .eq('source_provider', 'canvas');

    const existingEventMap = new Map(
      (existingEvents || []).map(e => [e.source_event_id, e])
    );

    const eventsToInsert = [];
    const eventsToUpdate = [];

    // Compare and categorize events
    for (const event of events) {
      const existing = existingEventMap.get(event.source_event_id);
      
      if (!existing) {
        // New event
        eventsToInsert.push({
          ...event,
          user_id: connection.user_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } else {
        // Check if event has changed
        if (existing.start_time !== event.start_time || 
            existing.end_time !== event.end_time || 
            existing.title !== event.title) {
          eventsToUpdate.push({
            ...event,
            user_id: connection.user_id,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    // Remove events that are no longer in the feed
    const currentEventIds = new Set(events.map(e => e.source_event_id));
    const eventsToDelete = (existingEvents || [])
      .filter(e => !currentEventIds.has(e.source_event_id))
      .map(e => e.source_event_id);

    let totalProcessed = 0;

    // Insert new events
    if (eventsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('events')
        .insert(eventsToInsert);
      
      if (insertError) {
        console.error(`Error inserting events for connection ${connection.id}:`, insertError);
      } else {
        console.log(`Inserted ${eventsToInsert.length} new events for connection ${connection.id}`);
        totalProcessed += eventsToInsert.length;
      }
    }

    // Update changed events
    for (const event of eventsToUpdate) {
      const { error: updateError } = await supabaseClient
        .from('events')
        .update({
          title: event.title,
          description: event.description,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          updated_at: event.updated_at
        })
        .eq('user_id', connection.user_id)
        .eq('source_event_id', event.source_event_id);

      if (updateError) {
        console.error(`Error updating event ${event.source_event_id}:`, updateError);
      } else {
        totalProcessed++;
      }
    }

    // Delete removed events
    if (eventsToDelete.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from('events')
        .delete()
        .eq('user_id', connection.user_id)
        .eq('source_provider', 'canvas')
        .in('source_event_id', eventsToDelete);

      if (deleteError) {
        console.error(`Error deleting events for connection ${connection.id}:`, deleteError);
      } else {
        console.log(`Deleted ${eventsToDelete.length} removed events for connection ${connection.id}`);
      }
    }

    // Update the connection's last sync time
    await supabaseClient
      .from('calendar_connections')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', connection.id);

    console.log(`Successfully synced connection ${connection.id}: ${eventsToInsert.length} new, ${eventsToUpdate.length} updated, ${eventsToDelete.length} deleted`);
    
    return { 
      success: true, 
      events_processed: totalProcessed,
      new_events: eventsToInsert.length,
      updated_events: eventsToUpdate.length,
      deleted_events: eventsToDelete.length
    };

  } catch (error) {
    console.error(`Error syncing connection ${connection.id}:`, error);
    return { success: false, reason: error.message };
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

    console.log('Starting automatic Canvas sync process...');

    // Get all active Canvas connections
    const { data: connections, error: connectionError } = await supabaseClient
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'canvas')
      .eq('is_active', true);

    if (connectionError) {
      console.error('Error fetching calendar connections:', connectionError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch calendar connections' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connections || connections.length === 0) {
      console.log('No active Canvas connections found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active Canvas connections to sync',
          connections_processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${connections.length} active Canvas connections to sync`);

    // Sync each connection
    const results = [];
    for (const connection of connections) {
      const result = await syncCanvasConnection(supabaseClient, connection);
      results.push({
        connection_id: connection.id,
        user_id: connection.user_id,
        ...result
      });
    }

    const successCount = results.filter(r => r.success).length;
    const totalEventsProcessed = results.reduce((sum, r) => sum + (r.events_processed || 0), 0);

    console.log(`Sync complete: ${successCount}/${connections.length} connections synced successfully, ${totalEventsProcessed} total events processed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${successCount}/${connections.length} connections`,
        connections_processed: connections.length,
        successful_syncs: successCount,
        total_events_processed: totalEventsProcessed,
        results: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-sync-canvas function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});