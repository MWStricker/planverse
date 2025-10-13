import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, userId } = await req.json();

    if (!description || !userId) {
      throw new Error('Description and userId are required');
    }

    console.log('AI Event Creation request:', { description, userId });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Call Lovable AI to parse the event description
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an event creation assistant. Parse the user's event description and extract:
- title: A clear, concise event title
- start_time: ISO 8601 timestamp (use current timezone context, default to next occurrence if date is relative)
- end_time: ISO 8601 timestamp
- description: Any additional details
- location: If mentioned
- event_type: One of: event, class, assignment, exam, work

Current date/time context: ${new Date().toISOString()}

Respond ONLY with valid JSON in this exact format:
{
  "title": "string",
  "start_time": "ISO 8601 timestamp",
  "end_time": "ISO 8601 timestamp",
  "description": "string or null",
  "location": "string or null",
  "event_type": "string"
}`
          },
          {
            role: 'user',
            content: description
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_event",
              description: "Create a calendar event from the parsed information",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Event title" },
                  start_time: { type: "string", description: "Start time in ISO 8601 format" },
                  end_time: { type: "string", description: "End time in ISO 8601 format" },
                  description: { type: "string", description: "Event description" },
                  location: { type: "string", description: "Event location" },
                  event_type: { 
                    type: "string", 
                    enum: ["event", "class", "assignment", "exam", "work"],
                    description: "Type of event (event=general event, class=class session, assignment=homework/project, exam=test/quiz, work=job-related)" 
                  }
                },
                required: ["title", "start_time", "end_time", "event_type"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_event" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error(`AI service error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData, null, 2));

    // Extract the parsed event data from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'create_event') {
      throw new Error('Failed to parse event details from AI');
    }

    const eventData = JSON.parse(toolCall.function.arguments);
    console.log('Parsed event data:', eventData);

    // Validate required fields
    if (!eventData.title || !eventData.start_time || !eventData.end_time) {
      throw new Error('Missing required event fields');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert the event into the database
    const { data: event, error: dbError } = await supabase
      .from('events')
      .insert({
        user_id: userId,
        title: eventData.title,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        description: eventData.description || null,
        location: eventData.location || null,
        event_type: eventData.event_type,
        source_provider: 'ai_generated',
        is_completed: false,
        is_all_day: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to save event: ${dbError.message}`);
    }

    console.log('Event created successfully:', event);

    return new Response(
      JSON.stringify({ success: true, event }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-create-event function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
