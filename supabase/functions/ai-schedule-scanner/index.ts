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

    // Call Google Cloud Vision API for text detection
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
              { type: 'TEXT_DETECTION', maxResults: 1 },
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
            ]
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

    if (!detectedText.trim()) {
      return new Response(
        JSON.stringify({ error: 'No readable text found in the schedule image' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Extracted text length:', detectedText.length);

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

TASK: Extract schedule information and identify the format type.

SCHEDULE FORMATS TO RECOGNIZE:
1. "Grid/Table Format" - Traditional weekly grid with days as columns, times as rows
2. "List Format" - Course listings with times and days
3. "Block Format" - Visual blocks showing course schedules
4. "Condensed Format" - Compact text-based schedule
5. "University Portal Format" - Standard university system printouts
6. "Mobile App Format" - Schedule from mobile applications

EXTRACTION RULES:
- Extract course codes, names, and numbers (e.g., "CS101", "Math 205", "HIST-1010")
- Identify days of the week (Mon, Tue, Wed, Thu, Fri, Sat, Sun or full names)
- Extract time ranges (e.g., "9:00-10:30", "2:00 PM - 3:15 PM")
- Find locations/rooms (e.g., "Room 204", "Building A", "Lab 3")
- Identify instructors/professors when mentioned
- Detect course types (Lecture, Lab, Discussion, Seminar)

TIME STANDARDIZATION:
- Convert all times to 24-hour format
- Handle various time formats (12-hour with AM/PM, 24-hour, etc.)

CONFIDENCE SCORING:
- High (0.8-1.0): Clear, well-structured schedule with all key elements
- Medium (0.5-0.79): Most elements clear, some ambiguity
- Low (0.0-0.49): Poorly formatted or unclear schedule

Return ONLY valid JSON with this exact structure:
{
  "format": "detected format name",
  "events": [
    {
      "course": "course code and name",
      "day": "day of week",
      "startTime": "HH:MM",
      "endTime": "HH:MM", 
      "location": "room/building",
      "instructor": "professor name",
      "type": "class type"
    }
  ],
  "rawText": "cleaned and formatted original text",
  "confidence": 0.85
}`
          },
          {
            role: 'user',
            content: `Analyze this schedule text and extract structured schedule information:\n\n${detectedText}`
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
      scheduleAnalysis = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
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