import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleEvent {
  course: string;
  day: string;
  startTime: string;
  endTime: string;
  location?: string;
  instructor?: string;
  type?: string; // lecture, lab, discussion, etc.
}

interface ScheduleAnalysis {
  format: string;
  events: ScheduleEvent[];
  rawText: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData } = await req.json();
    
    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'No image data provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const visionApiKey = Deno.env.get('VISION_API_KEY');
    if (!visionApiKey) {
      return new Response(
        JSON.stringify({ error: 'Vision API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Processing schedule image with Google Cloud Vision...');

    // Call Google Cloud Vision API for comprehensive text detection
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            image: {
              content: imageData.split(',')[1] // Remove data:image/... prefix
            },
            features: [
              { 
                type: 'TEXT_DETECTION', 
                maxResults: 50,
                model: 'builtin/latest'
              },
              { 
                type: 'DOCUMENT_TEXT_DETECTION', 
                maxResults: 50,
                model: 'builtin/latest'
              }
            ],
            imageContext: {
              languageHints: ['en'],
              textDetectionParams: {
                enableTextDetectionConfidenceScore: true,
                advancedOcrOptions: ['LEGACY_LAYOUT']
              }
            }
          }]
        })
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to process image with Vision API' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const visionData = await visionResponse.json();
    console.log('Vision API full response:', JSON.stringify(visionData, null, 2));

    if (!visionData.responses || !visionData.responses[0]) {
      return new Response(
        JSON.stringify({ error: 'No text detected in image' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const detectedText = visionData.responses[0].fullTextAnnotation?.text || 
                        visionData.responses[0].textAnnotations?.[0]?.description || '';

    // Also get individual text annotations for better parsing
    const textAnnotations = visionData.responses[0].textAnnotations || [];
    console.log('Text annotations count:', textAnnotations.length);
    
    // Log first few annotations for debugging
    textAnnotations.slice(0, 10).forEach((annotation, index) => {
      console.log(`Annotation ${index}:`, annotation.description, 'Confidence:', annotation.score);
    });
    
    const allDetectedTexts = textAnnotations.map(annotation => annotation.description).join(' ');
    
    // Combine both for comprehensive text extraction
    const combinedText = `${detectedText}\n\nAdditional detected text elements:\n${allDetectedTexts}`;

    console.log('Main detected text:', detectedText);
    console.log('All detected texts:', allDetectedTexts);

    if (!detectedText.trim() && !allDetectedTexts.trim()) {
      return new Response(
        JSON.stringify({ error: 'No readable text found in the schedule image' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Combined extracted text length:', combinedText.length);

    // Use OpenAI to analyze and structure the schedule data
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a schedule analysis expert with advanced spatial reasoning capabilities. Your job is to IGNORE document titles and headers, and ONLY extract individual event names that appear next to specific dates.

CRITICAL: IGNORE DOCUMENT TITLES AND HEADERS - FOCUS ON DATE-SPECIFIC EVENTS

MOST IMPORTANT RULE:
- Do NOT use the flyer title, document header, or page title as event names
- The title at the top of a schedule is NOT an event - it's just the document name
- Look for INDIVIDUAL event names positioned next to or under specific dates
- Each date should have a DIFFERENT event name based on what text appears near that specific date

STEP 1 - IDENTIFY AND IGNORE DOCUMENT STRUCTURE:
IGNORE these types of text (they are NOT events):
- Document titles at the top of the page
- Company names, site names, location headers
- Page headers like "Training Schedule", "Class Calendar", etc.
- Navigation elements, buttons, filters
- Month/year headers like "June 2013"

FOCUS ON these types of text (these ARE events):
- Specific activity names positioned next to/under date numbers
- Course names, training names, class names with times
- Individual event descriptions that appear near specific dates

STEP 2 - FIND INDIVIDUAL EVENT NAMES BY SCANNING LEFT TO RIGHT:
- Scan the text for patterns: DATE NUMBER → EVENT NAME → TIME
- Look for sequences like: "26 Air Pack Safety 8:00 AM - 11:00 AM"
- The text immediately after the date number is the event name
- Stop reading the event name when you hit the time (contains AM/PM or colons)
- Move to the next date number and repeat the process
- Each date number should be followed by different text (the event name for that date)

STEP 3 - EVENT NAME EXTRACTION RULES:
- Extract event names exactly as they appear in the original format
- Keep original time format (8:00 AM - 11:00 AM, not 08:00-11:00)
- If you see "26 Air Pack Safety 8:00 AM" then "Air Pack Safety" is the event for date 26
- If you see "27 Microsoft Office 10:00 AM" then "Microsoft Office" is the event for date 27
- Do NOT convert times to 24-hour format - keep original format with AM/PM

STEP 4 - HANDLE COMPLEX LAYOUTS:
- If events are stacked under dates, parse each one separately
- If event names are split across lines, combine them
- If times are on separate lines from names, associate them correctly
- Empty date cells should not have events assigned

CRITICAL DATE EXTRACTION RULES:
- Extract ACTUAL CALENDAR DATES in YYYY-MM-DD format, not day names
- For calendar formats: Look for date numbers (1-31) and the month/year context
- Map event names to their specific dates based on spatial positioning
- If year is clearly visible (like "2013", "2024"), use that year
- If year is NOT visible or unclear, default to current year: 2025
- If only month is visible (like "June"), use 2025 as the year

SPATIAL DATE-TO-EVENT MAPPING:
- Analyze the text flow to see which event names go with which dates
- Don't assign the same event to all dates - each date should have unique events
- If multiple events appear under one date, create separate entries for each
- If a date has no events near it, don't create an event for that date

STEP-BY-STEP EVENT EXTRACTION PROCESS:
1. Find a date number (like "26")
2. Look at the text that comes immediately after that date number
3. Extract that text as the event name until you reach a time or the next date
4. Extract the time in its original format (keep AM/PM)
5. Move to the next date number and repeat

EXAMPLE STEP-BY-STEP PARSING:
Text: "26 Air Pack Safety 8:00 AM - 11:00 AM 27 Microsoft Office 10:00 AM - 2:00 PM"

Step 1: Find "26" 
Step 2: Text after "26" is "Air Pack Safety"
Step 3: Time is "8:00 AM - 11:00 AM"
Result: Date 26 = "Air Pack Safety" at "8:00 AM - 11:00 AM"

Step 4: Find "27"
Step 5: Text after "27" is "Microsoft Office" 
Step 6: Time is "10:00 AM - 2:00 PM"
Result: Date 27 = "Microsoft Office" at "10:00 AM - 2:00 PM"

CRITICAL RULES FOR EVENT NAMES:
- Never use document titles, headers, or page titles as event names
- Extract the specific text that appears immediately after each date number
- Each date gets a completely different event name
- Keep times in original format with AM/PM (no military time)

CRITICAL EVENT NAME EXTRACTION:
- Only extract text that represents ACTUAL SCHEDULED ACTIVITIES
- Must have associated time information to be considered an event
- Look for patterns: "Event Name + Time" or "Time + Event Name"
- Ignore standalone times without event names
- Ignore event names without times (unless clearly part of a schedule entry)
- Extract complete event names as they appear, but verify they are real events

TEXT FILTERING - WHAT TO COMPLETELY IGNORE:
- Any text that appears to be navigation ("Schedule", "Filter", "Go To", "See")
- Location/site identifiers ("North Dakota", "My Site", "Area")
- Date headers and month/year labels ("June 2013", "2013")
- Calendar navigation elements
- Standalone date numbers (26, 27, 28) unless they have events under them
- Generic UI text and labels

EVENT VALIDATION CHECKLIST:
Before including any item as an event, verify:
1. ✅ Has a descriptive activity name
2. ✅ Has specific time information  
3. ✅ Represents something someone would attend
4. ❌ NOT a UI element, header, or navigation text
5. ❌ NOT a standalone date or time without context

DUPLICATE DETECTION:
- Remove exact duplicates
- Consolidate similar events if they're clearly the same activity

SCHEDULE FORMATS TO RECOGNIZE:
1. "Grid/Table Format" - Traditional weekly grid with days as columns, times as rows
2. "List Format" - Course listings with times and days
3. "Block Format" - Visual blocks showing course schedules
4. "Condensed Format" - Compact text-based schedule
5. "University Portal Format" - Standard university system printouts
6. "Mobile App Format" - Schedule from mobile applications
7. "Calendar View Format" - Monthly calendar with events on specific dates

CRITICAL EVENT NAME EXTRACTION:
- Only extract text that represents ACTUAL SCHEDULED ACTIVITIES
- Must have associated time information to be considered an event
- Look for patterns: "Event Name + Time" or "Time + Event Name"
- Ignore standalone times without event names
- Ignore event names without times (unless clearly part of a schedule entry)
- Extract complete event names as they appear, but verify they are real events

TEXT FILTERING - WHAT TO COMPLETELY IGNORE:
- Any text that appears to be navigation ("Schedule", "Filter", "Go To", "See")
- Location/site identifiers ("North Dakota", "My Site", "Area")
- Date headers and month/year labels ("June 2013", "2013")
- Calendar navigation elements
- Standalone date numbers (26, 27, 28) unless they have events under them
- Generic UI text and labels

EVENT VALIDATION CHECKLIST:
Before including any item as an event, verify:
1. ✅ Has a descriptive activity name
2. ✅ Has specific time information  
3. ✅ Represents something someone would attend
4. ❌ NOT a UI element, header, or navigation text
5. ❌ NOT a standalone date or time without context

DUPLICATE DETECTION:
- Remove exact duplicates
- Consolidate similar events if they're clearly the same activity

CRITICAL DATE EXTRACTION RULES:
- Extract ACTUAL CALENDAR DATES, not day names
- For calendar formats: Look for date numbers (1-31) and the month/year context
- Map event names to their specific dates based on spatial positioning
- Format dates as YYYY-MM-DD (e.g., "2025-06-26" for June 26, 2025)
- Each date should have its own event(s) based on what text appears near/under it

YEAR HANDLING:
- If year is clearly visible in the image (e.g., "2013", "2024"), use that year
- If year is NOT visible or unclear, default to current year: 2025
- If only month is visible (e.g., "June"), use 2025 as the year
- Better to use current year than guess an incorrect historical year

SPATIAL DATE-TO-EVENT MAPPING:
- Analyze the text flow to see which event names go with which dates
- Don't assign the same event to all dates - each date should have unique events
- If multiple events appear under one date, create separate entries for each
- If a date has no events near it, don't create an event for that date

DATE PARSING EXAMPLES:
- If you see "June 2013" with "26" → use "2013-06-26" (year is visible)
- If you see "June" with "26" but no year → use "2025-06-26" (default to current year)
- If you see "26 Air Pack Safety 8AM-11AM 27 Microsoft Office 10AM-2PM"
  → "2025-06-26": "Air Pack Safety", "2025-06-27": "Microsoft Office" (assuming June, current year)

TIME PARSING:
- Keep original time format exactly as it appears (do NOT convert to 24-hour format)
- If it says "8:00 AM - 11:00 AM", keep it as "8:00 AM - 11:00 AM"
- If it says "2:00 PM - 3:15 PM", keep it as "2:00 PM - 3:15 PM"
- Do NOT convert to military time (no 08:00, 14:00, etc.)
- Preserve the exact format from the source document
- Find locations/rooms when available
- Identify instructors/professors when mentioned
- Detect course types (Lecture, Lab, Discussion, Training, etc.)

CONFIDENCE SCORING:
- High (0.8-1.0): Clear date-event associations, accurate event names, proper date formatting
- Medium (0.5-0.79): Most elements clear, dates mostly accurate
- Low (0.0-0.49): Poor date-event mapping, unclear event names, or incorrect date format
If text shows:
"Mon Tue Wed
 26  27  28
Event A     Event B
8AM-9AM     2PM-3PM"

Then Event A should be on Monday (26th) and Event B should be on Tuesday (27th).

Return ONLY valid JSON with this exact structure:
{
  "format": "detected format name",
  "events": [
    {
      "course": "exact event name that appears after the date number",
      "day": "YYYY-MM-DD (actual calendar date)",
      "startTime": "original format with AM/PM",
      "endTime": "original format with AM/PM", 
      "location": "room/building if available",
      "instructor": "professor name if available",
      "type": "class type if identifiable"
    }
  ],
  "rawText": "cleaned and formatted original text",
  "confidence": 0.85
}`
          },
          {
            role: 'user',
            content: `CRITICAL: Extract individual event names that appear immediately after each date number. Do NOT use document titles. Keep time format as AM/PM (no military time). Use step-by-step parsing: find date number → extract text after it → that's the event name for that date. Here's the text:\n\n${combinedText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze schedule with AI' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const analysisContent = openaiData.choices[0].message.content;
    
    console.log('OpenAI analysis response:', analysisContent);

    let scheduleAnalysis: ScheduleAnalysis;
    try {
      // Handle cases where OpenAI wraps JSON in markdown code blocks
      let jsonContent = analysisContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      scheduleAnalysis = JSON.parse(jsonContent);
      console.log('Parsed schedule analysis:', scheduleAnalysis);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw response:', analysisContent);
      // Fallback response
      scheduleAnalysis = {
        format: "Unknown Format",
        events: [],
        rawText: detectedText,
        confidence: 0.1
      };
    }

    console.log('Schedule analysis completed:', {
      format: scheduleAnalysis.format,
      eventCount: scheduleAnalysis.events.length,
      confidence: scheduleAnalysis.confidence
    });

    return new Response(
      JSON.stringify(scheduleAnalysis),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in schedule scanner:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during schedule processing',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});