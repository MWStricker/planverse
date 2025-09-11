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
    const VISION_API_KEY = Deno.env.get('VISION_API_KEY');

    // OpenAI is required for structuring; Google Vision (VISION_API_KEY) is optional for OCR accuracy
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'OpenAI API key not configured', events: [], tasks: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const nowIso = currentDate || new Date().toISOString();
    const tz = timeZone || 'UTC';

    const systemPrompt = `You are an expert calendar parser specializing in Canvas LMS and academic calendars. Extract ALL visible assignments with PRECISE due dates.

Context: Today is ${nowIso} in ${tz}

CRITICAL DATE ACCURACY RULES:
1. CANVAS CALENDARS: Each assignment appears on its EXACT due date
2. Look carefully at the calendar grid structure - the day number shown IS the due date
3. If an assignment appears on "Sep 14", the due date is exactly September 14th of the current year
4. DO NOT add or subtract days - use the EXACT date where the assignment appears
5. Pay attention to month names/abbreviations in the calendar header
6. Use the calendar grid position to determine the precise date

CANVAS STRUCTURE ANALYSIS:
- Canvas shows a monthly grid with days 1-31
- Assignments appear on their exact due date squares
- Multiple assignments can be on the same day
- Look for partial assignment names that might be cut off

DATA EXTRACTION RULES:
1. Extract EVERY visible assignment, even if text is partially cut off
2. Assignment names go in "tasks" array (not events)
3. Only add times if explicitly shown (like "11:59 PM" or "2:00 PM")
4. If no time visible, leave dueTime as null
5. Default year: ${new Date().getFullYear()}
6. MINIMUM confidence = 85 (be precise, not generous)

MUST extract at least 1 item unless image is completely blank.`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'return_schedule_items',
          description: 'Return ALL extracted events and tasks as JSON - never return empty arrays',
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
                    startTime: { type: ['string', 'null'], pattern: '^\\d{2}:\\d{2}$' },
                    endTime: { type: ['string', 'null'], pattern: '^\\d{2}:\\d{2}$' },
                    location: { type: 'string' },
                    recurrence: { type: 'string' },
                    eventType: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                  },
                  required: ['title','date','confidence']
                }
              },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                    dueTime: { type: ['string', 'null'], pattern: '^\\d{2}:\\d{2}$' },
                    courseName: { type: 'string' },
                    priority: { type: 'number', minimum: 1, maximum: 4 },
                    taskType: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                  },
                  required: ['title','dueDate','confidence']
                }
              }
            },
            required: ['events', 'tasks']
          }
        }
      }
    ];

    // Prefer Google Cloud Vision for OCR if available
    async function extractTextWithGCV(base64: string, apiKey?: string): Promise<{ text: string; layout: { x: number; y: number; text: string }[] } | null> {
      if (!apiKey) return null;
      try {
        const visionResp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['en'] },
            }],
          }),
        });
        const visionData = await visionResp.json();

        const text = visionData?.responses?.[0]?.fullTextAnnotation?.text
          || visionData?.responses?.[0]?.textAnnotations?.[0]?.description
          || '';
        const extractedText = (typeof text === 'string' ? text : '').trim();

        // Build lightweight layout from individual textAnnotations (words)
        const items = visionData?.responses?.[0]?.textAnnotations || [];
        const words = Array.isArray(items) ? items.slice(1) : []; // skip full text at index 0
        let maxX = 0, maxY = 0;
        const layout: { x: number; y: number; text: string }[] = [];
        for (const w of words) {
          const desc = String(w?.description || '').trim();
          const verts = w?.boundingPoly?.vertices || [];
          if (!desc || verts.length === 0) continue;
          const xs = verts.map((v: any) => v?.x || 0);
          const ys = verts.map((v: any) => v?.y || 0);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          maxX = Math.max(maxX, ...xs);
          maxY = Math.max(maxY, ...ys);
          layout.push({ x: cx, y: cy, text: desc });
        }
        const normLayout = maxX > 0 && maxY > 0
          ? layout.map(it => ({ x: +(it.x / maxX).toFixed(4), y: +(it.y / maxY).toFixed(4), text: it.text }))
          : layout;

        console.log('GCV extracted text length:', extractedText.length);
        console.log('GCV words count:', normLayout.length);
        return { text: extractedText, layout: normLayout };
      } catch (e) {
        console.error('GCV OCR error:', e);
        return null;
      }
    }

    // Resolve best input: prefer Google Cloud Vision text if available
    let resolvedText = typeof text === 'string' ? text : '';
    let ocrSource = 'none';
    let layoutHints: { x: number; y: number; text: string }[] = [];
    if ((!resolvedText || resolvedText.trim().length === 0) && imageBase64 && VISION_API_KEY) {
      const gcvRes = await extractTextWithGCV(imageBase64, VISION_API_KEY);
      if (gcvRes && gcvRes.text.length > 0) {
        resolvedText = gcvRes.text;
        layoutHints = gcvRes.layout || [];
        ocrSource = 'gcv';
        console.log('Using GCV text, length:', gcvRes.text.length, 'layout items:', layoutHints.length);
      } else {
        console.log('GCV failed or returned empty text');
      }
    }

    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0;

    // Build detailed prompt for precise calendar analysis
    const instruction = `Analyze this calendar image with EXTREME PRECISION:

1. CANVAS LMS CALENDAR: Look at the monthly grid structure carefully
2. Each assignment appears on its EXACT due date square
3. Read the day numbers in the grid - that IS the due date
4. Extract assignment names as TASKS (not events)
5. Be 100% accurate with dates - do not guess or estimate
6. Look for month/year information in headers
7. Pay attention to calendar grid layout and positioning

Extract EVERYTHING visible with maximum precision.`;

    const contentParts: any[] = [];
    contentParts.push({ type: 'text', text: instruction });
    if (hasImage) {
      contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } });
    }
    if (resolvedText && resolvedText.length > 0) {
      contentParts.push({ type: 'text', text: `\n\nOCR Text from image:\n${resolvedText.slice(0, 8000)}` });
    }

    if (!hasImage && (!resolvedText || resolvedText.trim().length === 0)) {
      const durationMs = Date.now() - tStart;
      return new Response(
        JSON.stringify({ success: false, error: 'No image or text provided for analysis', events: [], tasks: [], durationMs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    async function callOpenAI(model: string, paramsType: 'legacy' | 'new'): Promise<Response> {
      const body: any = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contentParts as any },
        ],
        tools,
      };

      if (paramsType === 'legacy') {
        body.max_tokens = 1200;
        body.temperature = 0.1;
      } else {
        body.max_completion_tokens = 1200;
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

    // Use more powerful models for better accuracy
    console.log('Sending to OpenAI:', { textLength: resolvedText?.length || 0, hasImage });
    let response = await callOpenAI('gpt-4.1-2025-04-14', 'new');

    if (!response.ok) {
      console.log('GPT-4.1 failed, trying GPT-5 for maximum accuracy');
      response = await callOpenAI('gpt-5-2025-08-07', 'new');
    }

    if (!response.ok) {
      console.log('GPT-5 failed, trying GPT-4o-mini as compatibility fallback');
      response = await callOpenAI('gpt-4o-mini', 'legacy');
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText);
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: `OpenAI error ${response.status}: ${response.statusText}`, details: errText, events: [], tasks: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const aiData = await response.json();
    console.log('OpenAI response received, tool_calls:', aiData?.choices?.[0]?.message?.tool_calls?.length || 0);

    // Prefer function/tool call output
    let parsed: any = null;
    try {
      const toolCalls = aiData?.choices?.[0]?.message?.tool_calls || [];
      const fnCall = toolCalls.find((tc: any) => tc?.function?.name === 'return_schedule_items');
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
      console.log('No valid JSON parsed from OpenAI response');
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON from model', events: [], tasks: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Normalize & sanitize events
    let events = Array.isArray(parsed.events) ? parsed.events : [];
    console.log('Raw events from AI:', events.length);
    events = events
      .filter((e: any) => e?.title && typeof e?.title === 'string')
      .map((event: any, index: number) => ({
        id: event.id || `extracted_event_${Date.now()}_${index}`,
        title: String(event.title || '').trim().slice(0, 120),
        date: event.date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
        startTime: event.startTime && event.startTime !== 'null' ? String(event.startTime).slice(0, 5) : null,
        endTime: event.endTime && event.endTime !== 'null' ? String(event.endTime).slice(0, 5) : null,
        location: String(event.location || '').trim().slice(0, 120),
        recurrence: event.recurrence || null,
        eventType: String(event.eventType || 'class').trim().slice(0, 50),
        confidence: Number.isFinite(event.confidence) ? Math.max(0, Math.min(100, Number(event.confidence))) : 60,
      }));

    // Normalize & sanitize tasks
    let tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    console.log('Raw tasks from AI:', tasks.length);
    tasks = tasks
      .filter((t: any) => t?.title && typeof t?.title === 'string')
      .map((task: any, index: number) => ({
        id: task.id || `extracted_task_${Date.now()}_${index}`,
        title: String(task.title || '').trim().slice(0, 120),
        description: String(task.description || '').trim().slice(0, 500),
        dueDate: task.dueDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate() + 7).padStart(2, '0')}`,
        dueTime: task.dueTime && task.dueTime !== 'null' ? String(task.dueTime).slice(0, 5) : null,
        courseName: String(task.courseName || '').trim().slice(0, 100),
        priority: Number.isFinite(task.priority) ? Math.max(1, Math.min(4, Number(task.priority))) : 2,
        taskType: String(task.taskType || 'assignment').trim().slice(0, 50),
        confidence: Number.isFinite(task.confidence) ? Math.max(0, Math.min(100, Number(task.confidence))) : 60,
      }));

    const durationMs = Date.now() - tStart;
    console.log('Final result:', { events: events.length, tasks: tasks.length, ocrSource });
    return new Response(JSON.stringify({ success: true, durationMs, ocrSource, events, tasks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const durationMs = Date.now() - tStart;
    console.error('Function error:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unexpected error', events: [], tasks: [], durationMs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
