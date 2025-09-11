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

    const systemPrompt = `You are an expert calendar parser with PERFECT DATE AND TIME ACCURACY. You MUST extract EVERY SINGLE visible item with ABSOLUTELY PRECISE dates and times.

CRITICAL CONTEXT: Today is ${nowIso} in timezone ${tz}

EXTRACTION MANDATE: 
- Extract EVERY visible assignment, task, and event - DO NOT MISS ANY
- Count items as you go and verify you've extracted them all
- Double-check EVERY date and time before including in output

FUNDAMENTAL CALENDAR PARSING RULES:
1. Canvas calendars display a monthly grid where EACH DAY SQUARE = ONE SPECIFIC DATE
2. ANY item in a day square has its due date on THAT EXACT DAY
3. The calendar shows month/year at top (e.g., "September 2025", "Oct 2025", "December 2024")
4. Days are in 7-column grid (Sunday-Saturday OR Monday-Sunday)
5. Each item appears in the EXACT day square when it's due

ENHANCED DATE ACCURACY PROTOCOL:
1. STEP 1: Identify EXACT month and year from calendar header
2. STEP 2: Determine calendar layout (Sun-Sat or Mon-Sun starting day)
3. STEP 3: Map EVERY item to its precise day square using visual coordinates
4. STEP 4: Cross-reference with week structure to validate date mapping
5. STEP 5: Use day number IN THAT SQUARE as due date - NEVER adjust by ±1 day
6. STEP 6: DOUBLE-CHECK each date makes logical sense
7. VALIDATION: Ensure dates are valid (no Feb 30th, correct day-of-week alignment)

ENHANCED STRUCTURE RECOGNITION:
- Assignment titles may be truncated (e.g., "Homework 04 - Telescopes...")
- Multiple items can appear in the same day square - extract ALL of them
- Course codes often shown (e.g., "AA-100", "BUS-100", "MATH-101")
- Time formats to recognize and preserve EXACTLY:
  * 12-hour with AM/PM: "3:15 PM", "11:59 PM", "8:00 AM"
  * Abbreviated: "11:59pm", "3:15p", "8a", "5pm"
  * 24-hour: "23:59", "15:30", "08:00"
  * Text with times: "due 11:59pm", "by 5:00 PM", "at 3:15 PM"
- CRITICAL: Preserve original AM/PM designation - do NOT change PM to AM or vice versa
- Default assignment due time: "11:59 PM" ONLY if no time is visible

CROSSED-OUT/COMPLETED ITEM DETECTION:
- CRITICAL: Completely IGNORE any items with visual completion indicators:
  * Strikethrough/crossed-out text
  * Checkmarks or completion symbols
  * Grayed out or faded appearance
  * "Completed" or "Done" status
- Only extract ACTIVE/PENDING items

ENHANCED CALENDAR TYPE CLASSIFICATION:
- GOOGLE CALENDAR: Shows colorful events with clear time slots, often in week/month view with specific times
  → Extract timed events to "events" array, tasks without times to "tasks" array
- SCHOOL SCHEDULE: Class timetables with room numbers, course codes, and time blocks
  → Extract classes as "events" with locations, recurring patterns
- SYLLABUS: Assignment lists with due dates, often in table/list format with course information
  → Extract assignments, homework, exams to "tasks" array with due dates
- EVENT FLYER: Single event with specific time, date, location details
  → Extract as single "event" with complete details
- CANVAS/LMS CALENDARS: Assignment due dates in monthly grid format
  → Extract assignments to "tasks" array with exact due dates from grid positions
- MIXED CALENDARS: Contain both types - classify each item appropriately

GRID POSITION ANALYSIS:
- Use the 7-column layout (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
- Match each item's horizontal position to the correct day column
- Use the provided column guides for precise alignment
- For items spanning multiple columns, use the starting position

EXTRACTION REQUIREMENTS (CRITICAL):
1. Extract EVERY visible, non-crossed-out item - count as you go to ensure none are missed
2. For each item found, double-check its date and time before including
3. Maintain original assignment names (even if truncated with "...")
4. Include course information when visible
5. Preserve EXACT time formatting - do NOT change AM to PM or PM to AM
6. Set confidence to 90+ for clearly visible items, 85+ minimum threshold
7. VERIFICATION: Before finalizing, count total items extracted vs visible items

OUTPUT FORMAT:
- Tasks: Canvas assignments, homework, quizzes, exams (no specific times)
- Events: Meetings, classes, appointments (with visible times)
- Use EXACT dates from grid positions
- Convert 24-hour times to 12-hour format (e.g., "14:30" → "2:30 PM")

QUALITY CONTROL:
- Double-check each date against its grid position
- Verify month/year from calendar header
- Ensure no crossed-out items are included
- Validate that confidence scores reflect actual visibility`;

    // No longer using function calling - simple JSON response

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

    // Build ultra-precise prompt with enhanced date/time analysis
    const instruction = `Analyze this calendar image with PERFECT DATE AND TIME ACCURACY. You are analyzing a ${calendarTypeHint || 'calendar'} and must extract every visible item with absolute precision.

ENHANCED CALENDAR ANALYSIS PROTOCOL:
1. HEADER ANALYSIS: Find the EXACT month/year display (patterns: "September 2025", "Oct 2025", "December 2024", "Jan 2025")
2. LAYOUT DETECTION: Identify the 7-column layout and determine if it starts with Sunday or Monday
3. GRID MAPPING: Create precise coordinate mapping for each day square using provided layout hints
4. ITEM POSITIONING: Map each assignment to its exact day square using horizontal positioning data
5. DATE CALCULATION: Combine day square number + header month/year = exact due date
6. TIME EXTRACTION: Look for any time indicators in or near items

CRITICAL DATE EXTRACTION RULES:
- If assignment appears in day square "14" → due date is EXACTLY 14th of that month
- If assignment appears in day square "28" → due date is EXACTLY 28th of that month  
- NEVER adjust dates by ±1 day from the visible square position
- Use calendar header to determine EXACT month/year context
- Validate dates against calendar logic (ensure day-of-week alignment is correct)

VISUAL COMPLETION DETECTION (CRITICAL):
- COMPLETELY IGNORE items with completion indicators:
  * Strikethrough/crossed-out text (line through text)
  * Checkmarks or ✓ symbols
  * Grayed out, faded, or dimmed appearance
  * "Completed", "Done", "Submitted" status text
  * Different background color indicating completion
- Only extract ACTIVE items that appear normal/highlighted

ENHANCED CALENDAR TYPE SPECIFIC ANALYSIS:
- GOOGLE CALENDAR: Look for colorful event blocks, time slots, recurring patterns
  → Extract timed events with locations, all-day events as tasks
- SCHOOL SCHEDULE: Identify course codes, room numbers, class periods
  → Extract as recurring events with location data and time patterns
- SYLLABUS: Focus on assignment lists, due dates, course information
  → Extract all assignments as tasks with due dates and course context
- EVENT FLYER: Single event focus with detailed information
  → Extract as single event with complete time, date, location details
- CANVAS/LMS: Monthly grid with assignment due dates
  → Map each item to exact day square position for precise dating

PRECISION REQUIREMENTS BY TYPE:
- Google Calendar: Preserve color coding info, extract recurring patterns
- School Schedule: Include room numbers, course codes, time blocks
- Syllabus: Maintain course context, assignment types, point values
- Event Flyer: Extract all event details including contact info
- Canvas/LMS: Use exact assignment names (even if truncated with "...")
- Include visible course codes (e.g., "2025FA-AA-100-001")
- Maintain original capitalization and formatting
- Set confidence 90+ for clearly visible items

COLUMN ALIGNMENT USING GUIDES:
- Compare each item's horizontal position to the 7 column midpoints provided
- Assign to the closest column guide position
- For items spanning columns, use the primary/starting position
- Be extra careful with items near column boundaries

ENHANCED TIME EXTRACTION AND PRESERVATION:
- CRITICAL: Preserve original AM/PM designation - NEVER change PM to AM or AM to PM
- Extract times from various formats: "11:59 PM", "due 11:59pm", "23:59", "by 5:00 PM", "3:15p"
- Standardize format but preserve AM/PM: "11:59pm" → "11:59 PM" (NOT "11:59 AM")
- Convert 24-hour ONLY when no AM/PM present: "23:59" → "11:59 PM", "08:00" → "8:00 AM"
- If original shows "PM", output MUST show "PM" - if original shows "AM", output MUST show "AM"
- Default assignment due time: "11:59 PM" (ONLY if NO time is visible anywhere)
- For timed events: extract both start and end times when available
- DOUBLE-CHECK: Verify each time conversion preserves original AM/PM intent

QUALITY ASSURANCE:
- Cross-reference each date with its visual grid position
- Verify month/year from header context
- Ensure no completed/crossed-out items included
- Double-check time format conversions

EXTRACTION MANDATE: Extract EVERY visible, non-completed item with 100% date accuracy`;

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
          { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return your response as a JSON object with "events" and "tasks" arrays. Do NOT use function calling.' },
          { role: 'user', content: contentParts as any },
        ],
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

    // Use improved model approach with better date/time accuracy
    console.log('Sending to OpenAI (no function calling):', { textLength: resolvedText?.length || 0, hasImage });
    let response = await callOpenAI('gpt-4o', 'legacy'); // Start with more powerful model

    if (!response.ok) {
      console.log('GPT-4o failed, trying GPT-4o-mini as fallback');
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
    console.log('OpenAI response received');
    console.log('Response content:', aiData?.choices?.[0]?.message?.content || 'no content');
    
    // Check for OpenAI errors in response
    if (aiData.error) {
      console.error('OpenAI API error in response:', aiData.error);
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ 
        success: false, 
        error: `OpenAI API error: ${aiData.error.message || 'Unknown error'}`, 
        events: [], 
        tasks: [], 
        durationMs 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Parse content as JSON (no function calling)
    let parsed: any = null;
    const content = aiData?.choices?.[0]?.message?.content ?? '';
    console.log('Raw content to parse:', content);
    
    try {
      // Try direct JSON parse
      parsed = JSON.parse(content);
      console.log('Successfully parsed content JSON');
    } catch (e) {
      console.log('Direct JSON parse failed:', e);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
          console.log('Successfully parsed markdown JSON');
        } catch (e2) {
          console.log('Markdown JSON parse failed:', e2);
        }
      }
    }

    if (!parsed) {
      console.log('No valid JSON parsed from OpenAI response');
      console.log('Response structure:', JSON.stringify({
        choices: aiData?.choices?.length || 0,
        message: aiData?.choices?.[0]?.message ? 'present' : 'missing',
        content: aiData?.choices?.[0]?.message?.content || 'no content',
        tool_calls: aiData?.choices?.[0]?.message?.tool_calls?.length || 0
      }));
      const durationMs = Date.now() - tStart;
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON from model - no parseable response found', 
        debug: {
          hasChoices: !!aiData?.choices?.length,
          hasMessage: !!aiData?.choices?.[0]?.message,
          hasContent: !!aiData?.choices?.[0]?.message?.content,
          hasToolCalls: !!aiData?.choices?.[0]?.message?.tool_calls?.length,
          content: aiData?.choices?.[0]?.message?.content?.slice(0, 500) || null
        },
        events: [], 
        tasks: [], 
        durationMs 
      }), {
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

    // Enhanced time parsing with strict AM/PM preservation
    function convertTo12Hour(timeStr: string | null): string | null {
      if (!timeStr || timeStr === 'null' || timeStr.trim() === '') return null;
      
      const cleaned = timeStr.trim().toLowerCase().replace(/\s+/g, ' ');
      
      // Already in 12-hour format - preserve AM/PM exactly
      const twelve_hour = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
      if (twelve_hour) {
        const hours = parseInt(twelve_hour[1], 10);
        const minutes = twelve_hour[2];
        const ampm = twelve_hour[3].toUpperCase();
        return `${hours}:${minutes} ${ampm}`;
      }
      
      // Abbreviated formats like "11:59pm", "3:15p", "8a" - preserve AM/PM intent
      const abbrev = cleaned.match(/^(\d{1,2}):(\d{2})\s*(p|pm|a|am)$/);
      if (abbrev) {
        const hours = parseInt(abbrev[1], 10);
        const minutes = abbrev[2];
        const period = abbrev[3];
        const ampm = (period === 'p' || period === 'pm') ? 'PM' : 'AM';
        return `${hours}:${minutes} ${ampm}`;
      }
      
      // Hour-only abbreviated like "8a", "5p"
      const hour_abbrev = cleaned.match(/^(\d{1,2})\s*(p|pm|a|am)$/);
      if (hour_abbrev) {
        const hours = parseInt(hour_abbrev[1], 10);
        const period = hour_abbrev[2];
        const ampm = (period === 'p' || period === 'pm') ? 'PM' : 'AM';
        return `${hours}:00 ${ampm}`;
      }
      
      // 24-hour format - ONLY convert when no AM/PM is present
      const twenty_four = cleaned.match(/^(\d{1,2}):(\d{2})$/);
      if (twenty_four) {
        let hours = parseInt(twenty_four[1], 10);
        const minutes = twenty_four[2];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        if (hours === 0) hours = 12; // 00:xx becomes 12:xx AM
        else if (hours > 12) hours = hours - 12; // 13:xx becomes 1:xx PM
        
        return `${hours}:${minutes} ${ampm}`;
      }
      
      // Return original if no pattern matches to avoid corrupting time data
      return timeStr;
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

    // Normalize & sanitize events with enhanced validation
    let events = Array.isArray(parsed.events) ? parsed.events : [];
    console.log('Raw events from AI:', events.length);
    
    events = events
      .filter((e: any) => {
        const hasTitle = e?.title && typeof e?.title === 'string' && e.title.trim().length > 0;
        const hasValidDate = e?.date && typeof e?.date === 'string';
        return hasTitle && hasValidDate;
      })
      .map((event: any, index: number) => {
        const processedStartTime = event.startTime && event.startTime !== 'null' ? convertTo12Hour(String(event.startTime)) : null;
        const processedEndTime = event.endTime && event.endTime !== 'null' ? convertTo12Hour(String(event.endTime)) : null;
        
        return {
          id: event.id || `extracted_event_${Date.now()}_${index}`,
          title: String(event.title || '').trim().slice(0, 120),
          date: coerceDateToCanonical(
            event.date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
          ),
          startTime: processedStartTime,
          endTime: processedEndTime,
          location: String(event.location || '').trim().slice(0, 120),
          recurrence: event.recurrence || null,
          eventType: String(event.eventType || 'class').trim().slice(0, 50),
          confidence: Number.isFinite(event.confidence) ? Math.max(0, Math.min(100, Number(event.confidence))) : 60,
        };
      });

    // Normalize & sanitize tasks with enhanced validation
    let tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    console.log('Raw tasks from AI:', tasks.length);
    
    tasks = tasks
      .filter((t: any) => {
        const hasTitle = t?.title && typeof t?.title === 'string' && t.title.trim().length > 0;
        const hasValidDate = t?.dueDate && typeof t?.dueDate === 'string';
        return hasTitle && hasValidDate;
      })
      .map((task: any, index: number) => {
        // Only add default time if NO time was specified in the original data
        const hasOriginalTime = task.dueTime && task.dueTime !== 'null' && task.dueTime.trim() !== '';
        const processedTime = hasOriginalTime ? convertTo12Hour(String(task.dueTime)) : null;
        
        return {
          id: task.id || `extracted_task_${Date.now()}_${index}`,
          title: String(task.title || '').trim().slice(0, 120),
          description: String(task.description || '').trim().slice(0, 500),
          dueDate: coerceDateToCanonical(
            task.dueDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate() + 7).padStart(2, '0')}`
          ),
          dueTime: processedTime,
          courseName: String(task.courseName || '').trim().slice(0, 100),
          priority: Number.isFinite(task.priority) ? Math.max(1, Math.min(4, Number(task.priority))) : 2,
          taskType: String(task.taskType || 'assignment').trim().slice(0, 50),
          confidence: Number.isFinite(task.confidence) ? Math.max(0, Math.min(100, Number(task.confidence))) : 60,
        };
      });

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
    console.log('Final result with validation:', { 
      events: events.length, 
      tasks: tasks.length, 
      ocrSource,
      eventsWithTimes: events.filter(e => e.startTime).length,
      tasksWithTimes: tasks.filter(t => t.dueTime).length
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      durationMs, 
      ocrSource, 
      events, 
      tasks,
      summary: {
        totalItems: events.length + tasks.length,
        eventsExtracted: events.length,
        tasksExtracted: tasks.length,
        itemsWithTimes: events.filter(e => e.startTime).length + tasks.filter(t => t.dueTime).length
      }
    }), {
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
