import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const tStart = Date.now();

  try {
    const { imageBase64, mimeType, timeZone, currentDate } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Build a strong system prompt to anchor dates/years and enforce ISO output
    const nowIso = currentDate || new Date().toISOString();
    const tz = timeZone || 'UTC';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You extract academic schedule items from an image and return STRICT JSON.\n
- Today (for context): ${nowIso}\n- User timezone: ${tz}\n
Rules for dates/times:\n1) Always return dates as ISO YYYY-MM-DD (never MM/DD).\n2) Infer YEAR from the image (e.g., "Fall 2025", "2025-2026") or, if missing, choose the nearest FUTURE date within the next 12 months from today.\n3) If the image shows a month/week grid, align day-of-week with the date you output.\n4) Times must be 24h HH:MM.\n5) If start or end time is missing, estimate reasonably (e.g., 00:00 or 23:59) but keep it plausible.\n6) Keep locations short.\n7) Only include events you are confident about (confidence ≥ 60).\n
Return ONLY a JSON object in this exact structure:\n{\n  "events": [\n    {\n      "id": "unique_id",\n      "title": "event name",\n      "date": "YYYY-MM-DD",\n      "startTime": "HH:MM",\n      "endTime": "HH:MM",\n      "location": "location",\n      "recurrence": "optional recurrence pattern",\n      "confidence": number_0_to_100\n    }\n  ]\n}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all schedule information from this image. Be precise with dates and years.' },
              { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const durationMs = Date.now() - tStart;
      console.error('OpenAI API error:', response.status, response.statusText, errText);
      return new Response(JSON.stringify({ success: false, error: `OpenAI API error: ${response.status} ${response.statusText}`, details: errText, events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';

    let parsedEvents: any;
    try {
      parsedEvents = JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse AI response:', content);
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: 'Invalid response format from AI', events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (parsedEvents.events) {
      parsedEvents.events = parsedEvents.events
        .filter((e: any) => typeof e?.date === 'string' && /\d{4}-\d{2}-\d{2}/.test(e.date))
        .map((event: any, index: number) => ({
          ...event,
          id: event.id || `extracted_${Date.now()}_${index}`
        }));
    }

    const durationMs = Date.now() - tStart;

    return new Response(JSON.stringify({
      success: true,
      durationMs,
      ...parsedEvents
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in AI OCR:', error);
    const durationMs = Date.now() - tStart;
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unexpected error',
      events: [],
      durationMs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
