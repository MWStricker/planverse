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

function parseICS(icsContent: string, userTimezone: string = 'America/New_York'): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsContent.split(/\r?\n/).map(line => line.trim());
  
  let currentEvent: Partial<CalendarEvent> = {};
  let inEvent = false;
  let multiLineProperty = '';
  let multiLineValue = '';
  
  console.log(`Parsing ICS with ${lines.length} lines for timezone ${userTimezone}`);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line continuations (lines starting with space or tab)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      multiLineValue += line.substring(1);
      continue;
    } else if (multiLineProperty && multiLineValue) {
      // Process the completed multi-line property
      console.log(`Processing multi-line property ${multiLineProperty} with full value (length: ${multiLineValue.length})`);
      processProperty(multiLineProperty, multiLineValue, currentEvent, userTimezone);
      multiLineProperty = '';
      multiLineValue = '';
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        source_provider: 'canvas',
        event_type: 'assignment'
      };
      console.log('Starting new event parsing');
    } else if (line === 'END:VEVENT' && inEvent) {
      if (currentEvent.title) {
        // If no start_time, use current date
        if (!currentEvent.start_time) {
          currentEvent.start_time = new Date().toISOString();
          console.log(`No start time found for event "${currentEvent.title}", using current date`);
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
        console.log(`Added event: "${currentEvent.title}" at ${currentEvent.start_time}, description length: ${currentEvent.description?.length || 0}`);
        if (currentEvent.description && currentEvent.description.length > 0) {
          console.log(`Description preview: "${currentEvent.description.substring(0, 100)}${currentEvent.description.length > 100 ? '...' : ''}"`);
        }
      } else {
        console.log('Skipped event with no title');
      }
      currentEvent = {};
      inEvent = false;
    } else if (inEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const property = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      
      // Check if this might be a multi-line property
      if (value && !line.endsWith('\\')) {
        processProperty(property, value, currentEvent, userTimezone);
      } else {
        multiLineProperty = property;
        multiLineValue = value;
      }
    }
  }
  
  console.log(`Parsed ${events.length} events from ICS`);
  return events;
}

function processProperty(property: string, value: string, currentEvent: Partial<CalendarEvent>, userTimezone: string = 'America/New_York') {
  const cleanValue = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  
  if (property.startsWith('SUMMARY')) {
    currentEvent.title = cleanValue;
    console.log(`Title set: "${cleanValue}"`);
  } else if (property.startsWith('DESCRIPTION')) {
    currentEvent.description = cleanValue;
    console.log(`Description set (length ${cleanValue.length}): "${cleanValue.substring(0, 100)}${cleanValue.length > 100 ? '...' : ''}"`);
  } else if (property.startsWith('DTSTART')) {
    currentEvent.start_time = parseICSDate(value, userTimezone);
  } else if (property.startsWith('DTEND')) {
    currentEvent.end_time = parseICSDate(value, userTimezone);
  } else if (property.startsWith('DUE')) {
    // Canvas often uses DUE instead of DTSTART for assignments
    if (!currentEvent.start_time) {
      currentEvent.start_time = parseICSDate(value, userTimezone);
    }
    currentEvent.end_time = parseICSDate(value, userTimezone);
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

function parseICSDate(dateStr: string, userTimezone: string = 'America/New_York'): string {
  console.log(`Parsing date: ${dateStr} for timezone ${userTimezone}`);
  
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
      
      // For date-only events (like Canvas assignments), create at 11:59:59 PM in user's timezone
      // Then convert to UTC for proper storage
      const localDateStr = `${year}-${month}-${day}T23:59:59`;
      
      // Timezone offset mapping (in hours, standard time)
      // Note: This is simplified - DST would require a proper library
      const timezoneOffsets: { [key: string]: number } = {
        'America/New_York': -5,
        'America/Chicago': -6, 
        'America/Denver': -7,
        'America/Los_Angeles': -8,
        'America/Phoenix': -7,
        'US/Eastern': -5,
        'US/Central': -6,
        'US/Mountain': -7,
        'US/Pacific': -8,
      };
      
      const offsetHours = timezoneOffsets[userTimezone] || -5; // Default to EST
      
      // Create date and adjust to UTC
      const localDate = new Date(localDateStr);
      // Subtract the offset to convert FROM local TO UTC
      // Example: 11:59 PM Denver (UTC-7) = 6:59 AM UTC next day
      const utcDate = new Date(localDate.getTime() - (offsetHours * 60 * 60 * 1000));
      const result = utcDate.toISOString();
      
      console.log(`Parsed date-only: ${result} (original: ${dateStr}, local: ${localDateStr}, timezone: ${userTimezone})`);
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

    // Get the user's timezone preference
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('timezone')
      .eq('user_id', connection.user_id)
      .single();
    
    const userTimezone = userProfile?.timezone || 'America/New_York';
    console.log('Using user timezone:', userTimezone);

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

    // Parse the ICS content with user's timezone
    const events = parseICS(icsContent, userTimezone);
    console.log('Parsed events count:', events.length);

    // Log first few characters of ICS content for debugging
    console.log('ICS content sample:', icsContent.substring(0, 500));

    if (events.length === 0) {
      console.log('No events found - this might indicate parsing issues');
      console.log('ICS content length:', icsContent.length);
      console.log('Contains VEVENT:', icsContent.includes('VEVENT'));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No events found in Canvas feed. Check if the feed URL contains calendar events.',
          events_processed: 0,
          debug_info: {
            content_length: icsContent.length,
            contains_vevent: icsContent.includes('VEVENT'),
            content_sample: icsContent.substring(0, 200)
          }
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
    } else {
      console.log('Deleted existing Canvas events to avoid duplicates');
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