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
    const { imageBase64, mimeType, text, timeZone, currentDate, calendarTypeHint } = await req.json();
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

    // Compute column guides from layout hints to avoid off-by-one near boundaries
    function computeColumnGuides(layout: { x: number; y: number; text: string }[]): number[] | null {
      const dayTokens = layout.filter(it => {
        const n = Number(it.text);
        return Number.isFinite(n) && n >= 1 && n <= 31 && /^[0-9]{1,2}$/.test(it.text);
      });
      const xs = dayTokens.map(it => it.x).sort((a, b) => a - b);
      if (xs.length < 7) return null;
      const uniq: number[] = [];
      for (const x of xs) {
        if (uniq.length === 0 || Math.abs(x - uniq[uniq.length - 1]) > 0.02) uniq.push(x);
      }
      const arr = uniq.length >= 7 ? uniq : xs;
      const n = arr.length;
      const mids: number[] = [];
      for (let i = 1; i <= 7; i++) {
        const q = (i - 0.5) / 7;
        const idx = Math.max(0, Math.min(n - 1, Math.round(q * (n - 1))));
        mids.push(+arr[idx].toFixed(3));
      }
      mids.sort((a, b) => a - b);
      return mids;
    }

    const columnGuides = layoutHints && layoutHints.length > 0 ? computeColumnGuides(layoutHints) : null;

    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0;

    // Build detailed prompt for precise calendar analysis
    const instruction = `Analyze this calendar image with EXTREME PRECISION for column alignment.

CRITICAL GRID ANALYSIS:
- This is a 7-column calendar grid (Sunday-Saturday)
- Each column represents ONE specific day of the week
- Items must be assigned to the EXACT column they appear in
- Use the column guides provided to determine which column each item belongs to
- If an item appears between columns, assign it to the nearest column boundary

CALENDAR TYPE RULES:
- Events calendars (e.g., Google): Events have visible times next to titles. Output these in events[] with startTime/endTime.
- Canvas/tasks calendars: Assignments have due dates only (no times). Output these in tasks[] with dueTime null. Do NOT invent times.

DATE ACCURACY (no off-by-one):
- STEP 1: Identify the month/year from the calendar header
- STEP 2: Use the 7 column guides to determine which day column each item is in
- STEP 3: Match the column position to the day number in that column
- STEP 4: Use the exact day number from the grid cell, do NOT adjust ±1 day
- Never shift/normalize dates. Do not add or subtract days.

COLUMN ALIGNMENT RULES:
- Use the provided COLUMN GUIDES to snap each item to the correct column
- Compare each item's x-coordinate to the 7 column midpoints
- Assign items to the column with the closest midpoint
- Be extremely careful with items near column boundaries

OUTPUT RULES:
- Extract EVERYTHING visible. If an item has no time visible, put it in tasks (not events).
- ALL TIMES must be in 12-hour format with AM/PM (e.g., "2:30 PM", "11:59 PM")
- If you see 24-hour time (e.g., "14:30"), convert it to 12-hour format ("2:30 PM")
- Keep titles as shown (trimmed).`;

    const contentParts: any[] = [];
    contentParts.push({ type: 'text', text: instruction + (calendarTypeHint ? `\n\nUSER HINT: calendarTypeHint=${calendarTypeHint}` : '') });
    if (hasImage) {
      contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } });
    }
    if (resolvedText && resolvedText.length > 0) {
      contentParts.push({ type: 'text', text: `\n\nOCR Text from image:\n${resolvedText.slice(0, 6000)}` });
    }

    if (layoutHints && layoutHints.length > 0) {
      const maxHints = 200;
      const layoutSummary = layoutHints.slice(0, maxHints).map(it => `${it.x.toFixed(3)},${it.y.toFixed(3)}: ${it.text}`).join('\n');
      contentParts.push({ type: 'text', text: `\n\nLAYOUT HINTS (normalized x,y in [0-1], first ${Math.min(maxHints, layoutHints.length)} items):\n${layoutSummary}` });
    }

    if (columnGuides) {
      contentParts.push({ type: 'text', text: `\n\nCOLUMN GUIDES (7 column midpoints x in [0-1]):\n${columnGuides.join(', ')}` });
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

    // Infer canonical month/year from OCR text (e.g., "September 2025") to prevent off-by-one
    function monthFromName(name: string): number | null {
      const m = name.toLowerCase();
      const map: Record<string, number> = {
        jan: 1, january: 1,
        feb: 2, february: 2,
        mar: 3, march: 3,
        apr: 4, april: 4,
        may: 5,
        jun: 6, june: 6,
        jul: 7, july: 7,
        aug: 8, august: 8,
        sep: 9, sept: 9, september: 9,
        oct: 10, october: 10,
        nov: 11, november: 11,
        dec: 12, december: 12,
      };
      return map[m] || null;
    }
    function parseCanonicalMonthYear(text: string): { month: number; year: number } | null {
      const rx = /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*(20\d{2})/i;
      const m = text.match(rx);
      if (!m) return null;
      const month = monthFromName(m[1]);
      const year = parseInt(m[2], 10);
      if (!month || !year) return null;
      return { month, year };
    }

    // Convert 24-hour time to 12-hour format
    function convertTo12Hour(time24: string | null): string | null {
      if (!time24 || time24 === 'null') return null;
      
      const timeMatch = time24.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) return time24; // Return as-is if format doesn't match
      
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      if (hours === 0) hours = 12; // 00:xx becomes 12:xx AM
      else if (hours > 12) hours = hours - 12; // 13:xx becomes 1:xx PM
      
      return `${hours}:${minutes} ${ampm}`;
    }
    function daysInMonth(year: number, month1to12: number) {
      return new Date(year, month1to12, 0).getDate();
    }
    const canonical = parseCanonicalMonthYear(resolvedText || '');
    function coerceDateToCanonical(dateStr: string): string {
      if (!canonical) return dateStr;
      const m = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return dateStr;
      const day = parseInt(m[3], 10);
      const maxDay = daysInMonth(canonical.year, canonical.month);
      const safeDay = Math.min(Math.max(day, 1), maxDay);
      const mm = String(canonical.month).padStart(2, '0');
      const dd = String(safeDay).padStart(2, '0');
      return `${canonical.year}-${mm}-${dd}`;
    }

    // Normalize & sanitize events
    let events = Array.isArray(parsed.events) ? parsed.events : [];
    console.log('Raw events from AI:', events.length);
    events = events
      .filter((e: any) => e?.title && typeof e?.title === 'string')
      .map((event: any, index: number) => ({
        id: event.id || `extracted_event_${Date.now()}_${index}`,
        title: String(event.title || '').trim().slice(0, 120),
        date: coerceDateToCanonical(
          event.date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
        ),
        startTime: convertTo12Hour(event.startTime && event.startTime !== 'null' ? String(event.startTime).slice(0, 5) : null),
        endTime: convertTo12Hour(event.endTime && event.endTime !== 'null' ? String(event.endTime).slice(0, 5) : null),
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
        dueDate: coerceDateToCanonical(
          task.dueDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate() + 7).padStart(2, '0')}`
        ),
        dueTime: convertTo12Hour(task.dueTime && task.dueTime !== 'null' ? String(task.dueTime).slice(0, 5) : null),
        courseName: String(task.courseName || '').trim().slice(0, 100),
        priority: Number.isFinite(task.priority) ? Math.max(1, Math.min(4, Number(task.priority))) : 2,
        taskType: String(task.taskType || 'assignment').trim().slice(0, 50),
        confidence: Number.isFinite(task.confidence) ? Math.max(0, Math.min(100, Number(task.confidence))) : 60,
      }));

    // Reclassify: any event without a visible time becomes a task (Canvas-style due date)
    const extraTasksFromEvents = [] as any[];
    const keptEvents = [] as any[];
    for (const e of events) {
      const hasTime = !!(e.startTime && e.endTime);
      if (!hasTime) {
        extraTasksFromEvents.push({
          id: `from_event_${e.id}`,
          title: e.title,
          description: '',
          dueDate: e.date,
          dueTime: null,
          courseName: '',
          priority: 2,
          taskType: /quiz|exam|midterm|homework|assignment|discussion|project/i.test(e.title) ? 'assignment' : 'other',
          confidence: e.confidence,
        });
      } else {
        keptEvents.push(e);
      }
    }
    events = keptEvents;
    tasks = [...tasks, ...extraTasksFromEvents];

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
