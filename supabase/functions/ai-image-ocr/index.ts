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
    const { imageBase64, mimeType, text, timeZone, currentDate } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'OpenAI API key not configured', events: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowIso = currentDate || new Date().toISOString();
    const tz = timeZone || 'UTC';

    const systemPrompt = `You extract academic schedule items and MUST return via the provided function tool.\n\n- Today (for context): ${nowIso}\n- User timezone: ${tz}\n\nRules for dates/times:\n1) Dates: ISO YYYY-MM-DD only.\n2) Infer YEAR from the image/text (e.g., "Fall 2025"), else pick the nearest FUTURE date within 12 months.\n3) Align day-of-week with any month/week grid present.\n4) Times: 24h HH:MM.\n5) If a time is missing, choose a plausible default (start 08:00, end 17:00).\n6) Keep locations short.\n7) Only include items with confidence ≥ 60.\n`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'return_events',
          description: 'Return extracted events as strict JSON',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                    startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                    endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                    location: { type: 'string' },
                    recurrence: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                  },
                  required: ['title','date','startTime','endTime','location','confidence']
                }
              }
            },
            required: ['events']
          }
        }
      }
    ];

    const userImageContent = [
      { type: 'text', text: 'Extract all schedule information from this image. Be precise with dates and years.' },
      { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
    ];

    const userTextContent = `Extract all schedule information with precise dates and years from this text:\n\n${text || ''}`;

    async function callOpenAI(model: string, paramsType: 'legacy' | 'new', useText: boolean): Promise<Response> {
      const body: any = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: useText ? userTextContent : (userImageContent as any) },
        ],
        tools,
        tool_choice: { type: 'function', function: { name: 'return_events' } },
      };

      if (paramsType === 'legacy') {
        body.max_tokens = 600;
        body.temperature = 0.1;
      } else {
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

    // Decide if we are using image or text path
    const useText = typeof text === 'string' && text.trim().length > 0;

    // Try fast path first
    let response = await callOpenAI('gpt-4o-mini', 'legacy', useText);

    // Fallbacks
    if (!response.ok) response = await callOpenAI('o4-mini-2025-04-16', 'new', useText);
    if (!response.ok) response = await callOpenAI('gpt-4.1-2025-04-14', 'new', useText);

    if (!response.ok) {
      const errText = await response.text();
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: `OpenAI error ${response.status}: ${response.statusText}`, details: errText, events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();

    // Prefer function/tool call output
    let parsed: any = null;
    try {
      const toolCalls = aiData?.choices?.[0]?.message?.tool_calls || [];
      const fnCall = toolCalls.find((tc: any) => tc?.function?.name === 'return_events');
      if (fnCall?.function?.arguments) {
        parsed = JSON.parse(fnCall.function.arguments);
      }
    } catch (_) { /* ignore */ }

    // Fallback to content JSON extraction if needed
    if (!parsed) {
      const content = aiData?.choices?.[0]?.message?.content ?? '';
      try { parsed = JSON.parse(String(content)); } catch { /* try to salvage */ }
      if (!parsed) {
        const cleaned = String(content).replace(/```json\s*|```/g, '').trim();
        try { parsed = JSON.parse(cleaned); } catch { /* ignore */ }
      }
    }

    if (!parsed) {
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON from model', events: [], durationMs }), {
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
        startTime: String(event.startTime || '08:00').slice(0, 5),
        endTime: String(event.endTime || '17:00').slice(0, 5),
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
