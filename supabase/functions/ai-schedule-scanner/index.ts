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
              { type: 'TEXT_DETECTION', maxResults: 10 },
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 10 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 50 }
            ],
            imageContext: {
              languageHints: ['en'],
              textDetectionParams: {
                enableTextDetectionConfidenceScore: true
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
    console.log('Vision API response received');

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
    const allDetectedTexts = textAnnotations.map(annotation => annotation.description).join(' ');
    
    // Combine both for comprehensive text extraction
    const combinedText = `${detectedText}\n\nAdditional detected text elements:\n${allDetectedTexts}`;

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
            content: `You are a schedule analysis expert. Analyze the extracted text from a class schedule image and structure it into a standardized format.

TASK: Extract schedule information with PRECISE event names and correct day associations.

SCHEDULE FORMATS TO RECOGNIZE:
1. "Grid/Table Format" - Traditional weekly grid with days as columns, times as rows
2. "List Format" - Course listings with times and days
3. "Block Format" - Visual blocks showing course schedules
4. "Condensed Format" - Compact text-based schedule
5. "University Portal Format" - Standard university system printouts
6. "Mobile App Format" - Schedule from mobile applications
7. "Calendar View Format" - Monthly calendar with events on specific dates

CRITICAL EVENT NAME EXTRACTION:
- Extract COMPLETE and ACCURATE event/course names (e.g., "Advanced Programming", "Organic Chemistry Lab")
- Look for multi-word course titles that may be split across lines
- Pay attention to course codes with descriptions (e.g., "CS 101: Introduction to Programming")
- Capture training names, workshop titles, meeting names accurately
- Don't truncate or abbreviate event names unless they appear that way in the source

CRITICAL DAY EXTRACTION RULES:
- For calendar formats: Look for date numbers (1-31) and match events to those specific dates
- Convert date numbers to day names: Use context clues like "Mon Tue Wed Thu Fri Sat Sun" headers
- For weekly formats: Look for day abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun) or full names
- If events are under a specific date or day column, assign them to that day
- DO NOT default all events to Monday - carefully analyze spatial relationships
- If text shows "27 28 29 30 31" with events below specific numbers, map those to correct days

TIME AND DATE PARSING:
- Extract course codes, names, and numbers (e.g., "CS101", "Math 205", "HIST-1010")
- Extract time ranges (e.g., "8:00 AM - 11:00 AM", "2:00 PM - 3:15 PM")
- Convert all times to 24-hour format (8:00 AM = 08:00, 3:00 PM = 15:00)
- Find locations/rooms when available
- Identify instructors/professors when mentioned
- Detect course types (Lecture, Lab, Discussion, Training, etc.)

SPATIAL ANALYSIS FOR CALENDAR FORMATS:
- If you see date numbers like "26 27 28 29 30 31" followed by events, map events to their respective dates
- Look for patterns like events listed under specific date columns
- Use day headers (Sun Mon Tue Wed Thu Fri Sat) to determine which dates correspond to which days
- Calculate day of week based on calendar layout if possible

CONFIDENCE SCORING:
- High (0.8-1.0): Clear day-event associations, well-structured schedule
- Medium (0.5-0.79): Most elements clear, some day ambiguity resolved
- Low (0.0-0.49): Poor day-event mapping or unclear schedule

EXAMPLE ANALYSIS:
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
      "course": "course code and name",
      "day": "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",
      "startTime": "HH:MM",
      "endTime": "HH:MM", 
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
            content: `Analyze this schedule text and extract structured schedule information with ACCURATE event names and CORRECT day assignments. The text may contain multiple detection passes - use all available information to get complete event names:\n\n${combinedText}`
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