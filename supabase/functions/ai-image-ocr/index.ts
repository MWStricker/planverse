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
      return new Response(JSON.stringify({ success: false, error: 'OpenAI API key not configured', events: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowIso = currentDate || new Date().toISOString();
    const tz = timeZone || 'UTC';

    const systemPrompt = `You extract academic schedule items from an image and return STRICT JSON only.

- Today (for context): ${nowIso}
- User timezone: ${tz}

Rules for dates/times:
1) Always return dates as ISO YYYY-MM-DD (never MM/DD).
2) Infer YEAR from the image (e.g., "Fall 2025", "2025-2026") or, if missing, choose the nearest FUTURE date within the next 12 months from today.
3) If the image shows a month/week grid, align day-of-week with the date you output.
4) Times must be 24h HH:MM.
5) If start or end time is missing, estimate reasonably but keep it plausible.
6) Keep locations short.
7) Only include events you are confident about (confidence ≥ 60).

Return ONLY a JSON object in this exact structure:
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
}`;

    const userContent = [
      { type: 'text', text: 'Extract all schedule information from this image. Be precise with dates and years.' },
      { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
    ];

    async function callOpenAI(model: string, paramsType: 'legacy' | 'new'): Promise<Response> {
      const body: any = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent as any },
        ],
        response_format: { type: 'json_object' },
      };

      if (paramsType === 'legacy') {
        body.max_tokens = 600;
        body.temperature = 0.1;
      } else {
        // Newer models require max_completion_tokens and do not support temperature
        body.max_completion_tokens = 600;
      }

      return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    // Try fast legacy vision model first
    let response = await callOpenAI('gpt-4o-mini', 'legacy');

    // Fallback to newer fast reasoning vision model if first attempt fails
    if (!response.ok) {
      response = await callOpenAI('o4-mini-2025-04-16', 'new');
    }

    if (!response.ok) {
      const errText = await response.text();
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: `OpenAI error ${response.status}: ${response.statusText}`, details: errText, events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const content = aiData?.choices?.[0]?.message?.content ?? '';

    function tryParse(jsonLike: string): any | null {
      try { return JSON.parse(jsonLike); } catch { /* ignore */ }
      // Attempt to salvage JSON block from any extra text
      const match = jsonLike.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { /* ignore */ }
      }
      return null;
    }

    let parsed = tryParse(content);
    if (!parsed) {
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON from model', raw: content, events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize and sanitize events
    if (parsed.events && Array.isArray(parsed.events)) {
      parsed.events = parsed.events
        .filter((e: any) => typeof e?.date === 'string' && /\d{4}-\d{2}-\d{2}/.test(e.date))
        .map((event: any, index: number) => ({
          id: event.id || `extracted_${Date.now()}_${index}`,
          title: String(event.title || '').trim().slice(0, 120),
          date: event.date,
          startTime: String(event.startTime || '00:00').slice(0, 5),
          endTime: String(event.endTime || '23:59').slice(0, 5),
          location: String(event.location || '').trim().slice(0, 120),
          recurrence: event.recurrence || null,
          confidence: Number.isFinite(event.confidence) ? Math.max(0, Math.min(100, Number(event.confidence))) : 60,
        }));
    } else {
      parsed.events = [];
    }

    const durationMs = Date.now() - tStart;

    return new Response(JSON.stringify({ success: true, durationMs, ...parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const durationMs = Date.now() - tStart;
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unexpected error', events: [], durationMs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
