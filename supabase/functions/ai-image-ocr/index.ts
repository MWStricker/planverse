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
      return new Response(JSON.stringify({ success: false, error: 'OpenAI API key not configured', events: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowIso = currentDate || new Date().toISOString();
    const tz = timeZone || 'UTC';

    const systemPrompt = `You are an expert academic schedule extractor specializing in calendar layouts (Google Calendar, Outlook, etc). Return structured EVENTS and TASKS via the provided function only.

Context:
- Today: ${nowIso}
- User timezone: ${tz}

Calendar Parsing Rules:
- Look for recurring patterns: "MWF", "TR", "Mon Wed Fri", "Tues Thurs"
- Time formats: "9:00 AM", "2-3 PM", "14:00-15:30", "9a-11a", "2p"
- Date formats: "Jan 15", "Monday", "Mon 1/15", "15 Jan 2025"
- Course codes: "CS 101", "MATH 201", "ENG-302", "PHYS-1510"
- Event types: Lecture, Lab, Discussion, Office Hours, Exam, Quiz
- Assignment keywords: homework, assignment, project, paper, essay, lab report, quiz, exam, midterm, final

Formatting:
- Dates: YYYY-MM-DD (infer year from "Fall 2025", "Spring 2025", or use ${new Date().getFullYear()} if unclear)
- Times: 24h HH:MM format. Convert "2 PM" → "14:00", "9a" → "09:00"
- If only start time given, estimate end time (+1 hour for classes, +2 for labs)

Classification:
- EVENTS: scheduled time blocks (classes, meetings, office hours, exams)
- TASKS: assignments with due dates (homework, projects, papers, quizzes)

Only include items with confidence ≥ 50. If text is unclear or partially visible, still attempt extraction with lower confidence.`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'return_schedule_items',
          description: 'Return extracted events and tasks as strict JSON',
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
                    eventType: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                  },
                  required: ['title','date','startTime','endTime','confidence']
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
                    dueTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                    courseName: { type: 'string' },
                    priority: { type: 'number', minimum: 1, maximum: 4 },
                    taskType: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                  },
                  required: ['title','dueDate','priority','confidence']
                }
              }
            },
            required: ['events', 'tasks']
          }
        }
      }
    ];

    // Prefer Google Cloud Vision for OCR if available
    async function extractTextWithGCV(base64: string, apiKey?: string): Promise<string | null> {
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
        console.log('GCV extracted text length:', extractedText.length);
        console.log('GCV text preview:', extractedText.slice(0, 500));
        return extractedText;
      } catch (e) {
        console.error('GCV OCR error:', e);
        return null;
      }
    }

    // Resolve best input: prefer Google Cloud Vision text if available
    let resolvedText = typeof text === 'string' ? text : '';
    let ocrSource = 'none';
    if ((!resolvedText || resolvedText.trim().length === 0) && imageBase64 && VISION_API_KEY) {
      const gcvText = await extractTextWithGCV(imageBase64, VISION_API_KEY);
      if (gcvText && gcvText.length > 0) {
        resolvedText = gcvText;
        ocrSource = 'gcv';
        console.log('Using GCV text, length:', gcvText.length);
      } else {
        console.log('GCV failed or returned empty text');
      }
    }

    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0;
    const userImageContent = hasImage ? [
      { type: 'text', text: 'Extract all schedule information from this image. Identify both EVENTS (classes, meetings) and TASKS (assignments, homework, exams, projects). Be precise with dates, years, and times.' },
      { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
    ] : null;

    const userTextContent = `Source: ${ocrSource === 'gcv' ? 'Google Cloud Vision' : 'User text'}\n\nExtract all schedule information with precise DATES (YYYY-MM-DD), TIMES (HH:MM 24h), YEARS, assignment types, and course names from this text:\n\n${resolvedText || ''}`;

    const useTextInput = (resolvedText && resolvedText.trim().length > 0);
    const useImageInput = !useTextInput && hasImage;
    if (!useTextInput && !useImageInput) {
      const durationMs = Date.now() - tStart;
      return new Response(
        JSON.stringify({ success: false, error: 'No image or text provided for analysis', events: [], tasks: [], durationMs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    async function callOpenAI(model: string, paramsType: 'legacy' | 'new', useText: boolean): Promise<Response> {
      const body: any = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: useText ? userTextContent : (userImageContent as any) },
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

    // Decide content mode (already computed)
    const useText = useTextInput;

    // Try fast path first
    console.log('Sending to OpenAI:', { useText, textLength: resolvedText?.length || 0, hasImage: hasImage });
    let response = await callOpenAI('gpt-4o-mini', 'legacy', useText);

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText);
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ success: false, error: `OpenAI error ${response.status}: ${response.statusText}`, details: errText, events: [], durationMs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      });
    }

    // Normalize & sanitize events
    let events = Array.isArray(parsed.events) ? parsed.events : [];
    console.log('Raw events from AI:', events.length);
    events = events
      .filter((e: any) => typeof e?.date === 'string' && /\d{4}-\d{2}-\d{2}/.test(e.date))
      .map((event: any, index: number) => ({
        id: event.id || `extracted_event_${Date.now()}_${index}`,
        title: String(event.title || '').trim().slice(0, 120),
        date: event.date,
        startTime: String(event.startTime || '08:00').slice(0, 5),
        endTime: String(event.endTime || '17:00').slice(0, 5),
        location: String(event.location || '').trim().slice(0, 120),
        recurrence: event.recurrence || null,
        eventType: String(event.eventType || 'class').trim().slice(0, 50),
        confidence: Number.isFinite(event.confidence) ? Math.max(0, Math.min(100, Number(event.confidence))) : 60,
      }));

    // Normalize & sanitize tasks
    let tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    console.log('Raw tasks from AI:', tasks.length);
    tasks = tasks
      .filter((t: any) => typeof t?.dueDate === 'string' && /\d{4}-\d{2}-\d{2}/.test(t.dueDate))
      .map((task: any, index: number) => ({
        id: task.id || `extracted_task_${Date.now()}_${index}`,
        title: String(task.title || '').trim().slice(0, 120),
        description: String(task.description || '').trim().slice(0, 500),
        dueDate: task.dueDate,
        dueTime: String(task.dueTime || '23:59').slice(0, 5),
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
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unexpected error', events: [], tasks: [], durationMs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
