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

    const systemPrompt = `You extract academic schedule items from an image and return STRICT JSON only.\n\n- Today (for context): ${nowIso}\n- User timezone: ${tz}\n\nRules for dates/times:\n1) Always return dates as ISO YYYY-MM-DD (never MM/DD).\n2) Infer YEAR from the image (e.g., "Fall 2025", "2025-2026") or, if missing, choose the nearest FUTURE date within the next 12 months from today.\n3) If the image shows a month/week grid, align day-of-week with the date you output.\n4) Times must be 24h HH:MM.\n5) If start or end time is missing, estimate reasonably but keep it plausible.\n6) Keep locations short.\n7) Only include events you are confident about (confidence ≥ 60).\n\nReturn ONLY a JSON object in this exact structure:\n{\n  "events": [\n    {\n      "id": "unique_id",\n      "title": "event name",\n      "date": "YYYY-MM-DD",\n      "startTime": "HH:MM",\n      "endTime": "HH:MM",\n      "location": "location",\n      "recurrence": "optional recurrence pattern",\n      "confidence": number_0_to_100\n    }\n  ]\n}`;

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
        body.max_completion_tokens = 600; // newer models
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

    // Try fast, cheap legacy model first
    let response = await callOpenAI('gpt-4o-mini', 'legacy');

    // Fallbacks for reliability
    if (!response.ok) response = await callOpenAI('o4-mini-2025-04-16', 'new');
    if (!response.ok) response = await callOpenAI('gpt-4.1-2025-04-14', 'new');

    if (!response.ok) {
      const errText = await response.text();
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: `OpenAI error ${response.status}: ${response.statusText}`, details: errText, events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();

    // Robust JSON recovery
    function extractFromToolCall(data: any): any | null {
      try {
        const toolArgs = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (typeof toolArgs === 'string') {
          return JSON.parse(toolArgs);
        }
      } catch { /* ignore */ }
      return null;
    }

    function cleanCodeFences(s: string): string {
      return (s || '').replace(/```json\s*|```/g, '').trim();
    }

    function balancedJsonExtract(s: string): any | null {
      const str = s || '';
      const start = str.indexOf('{');
      if (start === -1) return null;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (inStr) {
          if (!esc && ch === '"') inStr = false;
          esc = !esc && ch === '\\';
        } else {
          if (ch === '"') inStr = true;
          else if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              const candidate = str.slice(start, i + 1);
              try { return JSON.parse(candidate); } catch { /* try next */ }
            }
          }
        }
      }
      return null;
    }

    const content = aiData?.choices?.[0]?.message?.content ?? '';

    let parsed = extractFromToolCall(aiData);
    if (!parsed) {
      const cleaned = cleanCodeFences(content);
      try { parsed = JSON.parse(cleaned); } catch { /* ignore */ }
      if (!parsed) parsed = balancedJsonExtract(cleaned);
    }

    if (!parsed) {
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON from model', raw: content, events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize & sanitize
    let events = Array.isArray(parsed.events) ? parsed.events : [];
    events = events
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

    const durationMs = Date.now() - tStart;
    return new Response(JSON.stringify({ success: true, durationMs, events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const durationMs = Date.now() - tStart;
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unexpected error', events: [], durationMs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
