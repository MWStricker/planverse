import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI that extracts academic schedule information from images. 
            Analyze the image and extract all events, classes, assignments, and important dates.
            Return ONLY a valid JSON object with this exact structure:
            {
              "events": [
                {
                  "id": "unique_id",
                  "title": "event name",
                  "date": "YYYY-MM-DD",
                  "startTime": "HH:MM",
                  "endTime": "HH:MM", 
                  "location": "location",
                  "recurrence": "optional recurrence pattern",
                  "confidence": number_0_to_100
                }
              ]
            }`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all schedule information from this image. Look for classes, meetings, assignments, exams, due dates, and any other academic events. Be thorough and precise.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;

    // Parse the JSON response
    let parsedEvents;
    try {
      parsedEvents = JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid response format from AI');
    }

    // Add unique IDs if missing
    if (parsedEvents.events) {
      parsedEvents.events = parsedEvents.events.map((event: any, index: number) => ({
        ...event,
        id: event.id || `extracted_${Date.now()}_${index}`
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      ...parsedEvents
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI OCR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      events: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});