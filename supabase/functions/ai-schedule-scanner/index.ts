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
            content: `You are a schedule analysis expert. Extract ONLY real scheduled events with proper names, dates, and times.

CRITICAL FILTERING - IGNORE THESE COMPLETELY:
- Document titles, headers, page titles
- Navigation text: "Schedule", "Filter", "Go To", "See Schedule", "My Site"
- Location headers: "North Dakota", "Area", site names
- Month/year labels: "June 2013", calendar navigation
- UI elements: buttons, dropdowns, form fields
- Date numbers by themselves (26, 27, 28) without associated events

WHAT COUNTS AS A REAL EVENT:
- Must have a descriptive activity name (not just a location or UI element)
- Must have time information (like "8:00 AM - 11:00 AM")
- Must be something someone would actually attend

STEP-BY-STEP EXTRACTION PROCESS:

1. FIND EVENT PATTERNS:
Look for text patterns like: "DATE EVENT_NAME TIME"
Example: "26 Air Pack Safety 8:00 AM - 11:00 AM"

2. EXTRACT COMPONENTS:
- Date: "26" → convert to "2025-06-26" (use 2025 if year unclear)
- Event Name: "Air Pack Safety" (text between date and time)
- Time: "8:00 AM - 11:00 AM" (keep original format with AM/PM)

3. VALIDATE EACH EVENT:
Before including, verify:
✅ Has descriptive event name (not "Schedule", "Filter", etc.)
✅ Has specific time information
✅ Is positioned near a date number
❌ Is NOT a UI element or header

4. EXTRACT TIMES PROPERLY:
- Keep original format: "8:00 AM - 11:00 AM" 
- Split into startTime: "8:00 AM" and endTime: "11:00 AM"
- If only one time given, use it for both start and end
- Do NOT convert to military time

PARSING EXAMPLES:

✅ CORRECT:
Text: "26 Air Pack Safety 8:00 AM - 11:00 AM 27 Microsoft Office 2:00 PM - 4:00 PM"
Extract:
- Date: 2025-06-26, Event: "Air Pack Safety", Start: "8:00 AM", End: "11:00 AM"
- Date: 2025-06-27, Event: "Microsoft Office", Start: "2:00 PM", End: "4:00 PM"

❌ WRONG - DON'T EXTRACT:
Text: "Schedule Filter Site Name North Dakota"
These are UI elements, not events.

CONFIDENCE SCORING:
- High (0.8-1.0): Clear events with names, dates, and times
- Medium (0.5-0.79): Most events clear, some minor issues
- Low (0.0-0.49): Poor extraction, many UI elements detected

Return ONLY valid JSON with this structure:
{
  "format": "Calendar View Format",
  "events": [
    {
      "course": "exact event name from text",
      "day": "YYYY-MM-DD",
      "startTime": "H:MM AM/PM format",
      "endTime": "H:MM AM/PM format",
      "location": "",
      "instructor": "",
      "type": "Training"
    }
  ],
  "rawText": "original extracted text",
  "confidence": 0.85
}`
          },
          {
            role: 'user',
            content: `Extract ONLY real scheduled events. Ignore UI text completely. For each real event, extract: date number → event name → time range. Keep times in AM/PM format. Split time ranges into separate startTime and endTime. Each date should have different event names. Here's the text:\n\n${combinedText}`
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