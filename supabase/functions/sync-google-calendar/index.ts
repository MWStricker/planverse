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

    // Get the connection details from database to check for stored tokens
    const { data: connectionDetails, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('access_token, refresh_token, provider_id')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connectionDetails) {
      throw new Error('Calendar connection not found');
    }

    // Use stored access token if no token provided in request
    const finalAccessToken = accessToken || connectionDetails.access_token;
    
    if (!finalAccessToken) {
      throw new Error('No access token available. Please reconnect your Google Calendar by clicking "Connect Now" in the integrations section.');
    }

    console.log(`Starting Google Calendar sync for connection: ${connectionId}`);
    
    // Debug: Check what scopes the token actually has
    console.log('🔍 Checking token scopes...');
    try {
      const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${finalAccessToken}`);
      const tokenInfo = await tokenInfoResponse.json();
      console.log('🔑 Token scopes:', tokenInfo.scope);
      console.log('🔑 Token info:', JSON.stringify(tokenInfo, null, 2));
    } catch (scopeError) {
      console.error('❌ Error checking token scopes:', scopeError);
    }

    // Declare events and tasks variables with proper scope
    let events = [];
    let tasks = [];

    // For testing purposes, if no real access token, create sample Google Calendar events
    if (!finalAccessToken || finalAccessToken === 'mock_token_for_testing') {
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
      let currentAccessToken = finalAccessToken;
      
      // Function to refresh token if needed
      const refreshTokenIfNeeded = async (response: Response) => {
        if (response.status === 401 || response.status === 403) {
          console.log('🔄 Access token expired, attempting to refresh...');
          
          // Get the refresh token from connectionDetails if not provided by session
          const refreshToken = connectionDetails?.refresh_token;
          
          if (refreshToken) {
            console.log('🔑 Refreshing access token...');
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
                client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
              }),
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              currentAccessToken = refreshData.access_token;
              
              // Update the connection with new token
              await supabase
                .from('calendar_connections')
                .update({
                  access_token: currentAccessToken,
                  token_expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', connectionId);
              
              console.log('✅ Access token refreshed successfully');
              return true;
            } else {
              console.error('❌ Failed to refresh token:', refreshResponse.status);
              return false;
            }
          } else {
            console.error('❌ No refresh token available');
            return false;
          }
        }
        return true;
      };

      let calendarsData;
      const calendarsResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            'Authorization': `Bearer ${currentAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Try to refresh token if initial request fails
      if (!calendarsResponse.ok) {
        const refreshed = await refreshTokenIfNeeded(calendarsResponse);
        if (refreshed && currentAccessToken !== accessToken) {
          // Retry with new token
          const retryResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            {
              headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (!retryResponse.ok) {
            throw new Error(`Failed to fetch calendars after token refresh: ${retryResponse.status}`);
          }
          
          calendarsData = await retryResponse.json();
        } else {
          throw new Error(`Failed to fetch calendars: ${calendarsResponse.status}. Please reconnect your Google Calendar.`);
        }
      } else {
        calendarsData = await calendarsResponse.json();
      }

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
                'Authorization': `Bearer ${currentAccessToken}`,
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

      // Fetch Google Tasks
      console.log('📋 Fetching Google Tasks...');
      let tasks = [];
      
      try {
        // Get all task lists
        console.log('🔍 Requesting task lists from Google Tasks API...');
        console.log('🔑 Access token (first 50 chars):', currentAccessToken?.substring(0, 50) + '...');
        
        const taskListsResponse = await fetch(
          'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
          {
            headers: {
              'Authorization': `Bearer ${currentAccessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log(`📊 Task lists response status: ${taskListsResponse.status}`);
        if (!taskListsResponse.ok) {
          const errorText = await taskListsResponse.text();
          console.error(`❌ Failed to fetch task lists: ${taskListsResponse.status}`);
          console.error(`❌ Error details: ${errorText}`);
        } else {
          const taskListsData = await taskListsResponse.json();
          console.log(`📋 Raw task lists response:`, JSON.stringify(taskListsData, null, 2));
          const taskLists = taskListsData.items || [];
          console.log(`Found ${taskLists.length} task lists:`, taskLists.map(tl => `"${tl.title}"`));

          // Fetch tasks from each task list
          for (const taskList of taskLists) {
            console.log(`📝 Fetching tasks from list: ${taskList.title} (ID: ${taskList.id})`);
            
            const tasksUrl = `https://tasks.googleapis.com/tasks/v1/lists/${taskList.id}/tasks?showCompleted=true&showHidden=false&maxResults=100`;
            console.log(`🔗 Tasks API URL: ${tasksUrl}`);
            
            const tasksResponse = await fetch(tasksUrl, {
              headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json',
              },
            });

            if (tasksResponse.ok) {
              const tasksData = await tasksResponse.json();
              console.log(`📋 Raw tasks response for "${taskList.title}":`, JSON.stringify(tasksData, null, 2));
              const listTasks = tasksData.items || [];
              
              // Add task list info to each task
              listTasks.forEach(task => {
                task.taskListName = taskList.title;
                task.taskListId = taskList.id;
                console.log(`🔍 Task details: "${task.title}" - Status: ${task.status}, Due: ${task.due || 'No due date'}, Updated: ${task.updated}`);
              });
              
              tasks = tasks.concat(listTasks);
              console.log(`✅ Fetched ${listTasks.length} tasks from ${taskList.title}`);
            } else {
              const errorText = await tasksResponse.text();
              console.error(`❌ Failed to fetch tasks from list ${taskList.title}: ${tasksResponse.status}`);
              console.error(`❌ Tasks API error details: ${errorText}`);
            }
          }
          
          console.log(`🎯 TOTAL TASKS FETCHED: ${tasks.length}`);
          if (tasks.length === 0) {
            console.log('⚠️  No tasks found. This could mean:');
            console.log('   1. You have no tasks in Google Tasks');
            console.log('   2. All your tasks are completed and hidden');
            console.log('   3. There\'s a scope/permission issue');
          }
        }
      } catch (taskError) {
        console.error('❌ Error fetching Google Tasks:', taskError);
        console.error('❌ Task error details:', taskError.message);
        console.error('❌ Task error stack:', taskError.stack);
      }
    }

    console.log(`Processing ${events.length} events and ${tasks?.length || 0} tasks from Google Calendar`);

    console.log(`Processing ${events.length} events and ${tasks?.length || 0} tasks from Google Calendar`);

    let syncedEvents = 0;
    let syncedTasks = 0;
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

    // Process Google Tasks
    console.log(`📋 TASK DEBUG: Found ${tasks ? tasks.length : 0} tasks from Google API`);
    if (tasks && tasks.length > 0) {
      console.log(`📋 Processing ${tasks.length} Google Tasks`);
      
      for (const task of tasks) {
        try {
          console.log(`🔍 TASK DEBUG: Task "${task.title}" - Status: ${task.status}, Due: ${task.due}, Notes: ${task.notes ? 'Has notes' : 'No notes'}`);
          
          // Skip completed tasks that don't have due dates (to avoid clutter)
          if (task.status === 'completed' && !task.due) {
            console.log(`⏭️ SKIPPING completed task without due date: ${task.title}`);
            continue;
          }

          console.log(`🔄 Processing task: ${task.title || 'Untitled'} from ${task.taskListName || 'Unknown list'}`);

          // Check if task already exists
          const { data: existingTask } = await supabase
            .from('tasks')
            .select('id, updated_at')
            .eq('user_id', user.id)
            .eq('source_provider', 'google')
            .eq('source_assignment_id', task.id)
            .single();

          // Determine due date
          let dueDate = null;
          if (task.due) {
            dueDate = new Date(task.due).toISOString();
          }

          const taskData = {
            user_id: user.id,
            title: task.title || 'Untitled Task',
            description: [
              task.notes || '',
              task.taskListName ? `📋 List: ${task.taskListName}` : '',
              task.webViewLink ? `🔗 View in Google Tasks: ${task.webViewLink}` : ''
            ].filter(Boolean).join('\n\n'),
            due_date: dueDate,
            completion_status: task.status === 'completed' ? 'completed' : 'pending',
            completed_at: task.completed ? new Date(task.completed).toISOString() : null,
            priority_score: 5, // Google Tasks doesn't have priority, so default to medium (score 5)
            source_provider: 'google',
            source_assignment_id: task.id,
            updated_at: new Date().toISOString(),
          };

          if (existingTask) {
            // Update existing task
            const { error: updateError } = await supabase
              .from('tasks')
              .update(taskData)
              .eq('id', existingTask.id);

            if (updateError) {
              console.error(`❌ Error updating task ${task.title}:`, updateError);
              errors++;
            } else {
              console.log(`✅ Updated task: ${task.title}`);
              syncedTasks++;
            }
          } else {
            // Create new task
            taskData.created_at = new Date().toISOString();
            
            const { error: insertError } = await supabase
              .from('tasks')
              .insert(taskData);

            if (insertError) {
              console.error(`❌ Error inserting task ${task.title}:`, insertError);
              errors++;
            } else {
              console.log(`🆕 Created new task: ${task.title}`);
              syncedTasks++;
            }
          }
        } catch (taskError) {
          console.error(`❌ Error processing task ${task.title || 'Unknown'}:`, taskError);
          errors++;
        }
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

    console.log(`Sync complete: ${syncedEvents} events synced, ${syncedTasks} tasks synced, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedEvents,
        syncedTasks,
        errors,
        totalEvents: events.length,
        totalTasks: tasks?.length || 0,
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