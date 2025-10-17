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

    // Use Lovable AI with Gemini 2.5 Flash for structured schedule extraction
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'Lovable API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get current date for smart semester detection
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Determine academic year and semester
    const academicYear = currentMonth >= 8 ? currentYear : currentYear - 1; // Aug+ = current year
    const nextYear = academicYear + 1;
    const semester = currentMonth >= 1 && currentMonth <= 5 ? 'Spring' : 'Fall';
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting class schedules from text. Current context: ${semester} ${academicYear}-${nextYear}.

EXTRACT ONLY real scheduled classes/events. IGNORE:
- UI elements ("Schedule", "Filter", "My Courses")
- Headers and titles
- Navigation text
- Empty date cells

FOR EACH CLASS/EVENT, EXTRACT:
1. Course name (e.g., "PSY 100", "Air Pack Safety")
2. Day/Date - Convert to ISO format YYYY-MM-DD:
   - If you see "Monday", "Tuesday", etc. → find next occurrence in ${semester} ${academicYear}
   - If you see day numbers (26, 27) → assume current month or next month
   - Default year: ${academicYear}
3. Time - Keep as "H:MM AM" or "H:MM PM" format:
   - Split ranges: "8:00 AM - 11:00 AM" → start: "8:00 AM", end: "11:00 AM"
   - Single time → use for both start and end
4. Location (if present)
5. Instructor (if present)
6. Type: "lecture", "lab", "discussion", "training", etc.

VALIDATION:
- Start time MUST be before end time
- Events must have a descriptive name (not generic UI text)
- Dates must be reasonable (within ${academicYear}-${nextYear} academic year)

Return confidence score:
- 0.9-1.0: Clear schedule with all info
- 0.7-0.89: Most events clear, minor gaps
- 0.5-0.69: Some uncertainty
- Below 0.5: Poor quality/unclear schedule`
          },
          {
            role: 'user',
            content: `Extract the class schedule from this text. Current semester: ${semester} ${academicYear}. Convert all dates to YYYY-MM-DD format. Keep times in AM/PM format.\n\n${combinedText}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_schedule",
              description: "Extract structured schedule data from text",
              parameters: {
                type: "object",
                properties: {
                  format: {
                    type: "string",
                    description: "Type of schedule format detected (e.g., 'Weekly Grid', 'Calendar View', 'List Format')"
                  },
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        course: {
                          type: "string",
                          description: "Course or event name"
                        },
                        day: {
                          type: "string",
                          description: "Date in YYYY-MM-DD format"
                        },
                        startTime: {
                          type: "string",
                          description: "Start time in 'H:MM AM/PM' format"
                        },
                        endTime: {
                          type: "string",
                          description: "End time in 'H:MM AM/PM' format"
                        },
                        location: {
                          type: "string",
                          description: "Location/room (optional)"
                        },
                        instructor: {
                          type: "string",
                          description: "Instructor name (optional)"
                        },
                        type: {
                          type: "string",
                          description: "Event type: lecture, lab, discussion, training, etc."
                        }
                      },
                      required: ["course", "day", "startTime", "endTime"]
                    }
                  },
                  rawText: {
                    type: "string",
                    description: "Original extracted text for reference"
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score from 0.0 to 1.0"
                  }
                },
                required: ["format", "events", "rawText", "confidence"]
              }
            }
          }
        ],
        tool_choice: {
          type: "function",
          function: { name: "extract_schedule" }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      
      // Handle rate limiting and payment errors
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to analyze schedule with AI' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    let scheduleAnalysis: ScheduleAnalysis;
    try {
      // Extract from tool call response
      const toolCall = aiData.choices[0].message.tool_calls?.[0];
      if (toolCall && toolCall.function.name === 'extract_schedule') {
        scheduleAnalysis = JSON.parse(toolCall.function.arguments);
        console.log('Parsed schedule from tool call:', scheduleAnalysis);
      } else {
        // Fallback to content parsing (shouldn't happen with tool_choice)
        const analysisContent = aiData.choices[0].message.content || '{}';
        scheduleAnalysis = JSON.parse(analysisContent);
      }
      
      // Validate and fix events
      scheduleAnalysis.events = scheduleAnalysis.events.filter(event => {
        // Validate required fields
        if (!event.course || !event.day || !event.startTime || !event.endTime) {
          console.log('Skipping invalid event:', event);
          return false;
        }
        
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(event.day)) {
          console.log('Invalid date format:', event.day);
          return false;
        }
        
        // Validate time format (H:MM AM/PM)
        if (!/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(event.startTime) || 
            !/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(event.endTime)) {
          console.log('Invalid time format:', event.startTime, event.endTime);
          return false;
        }
        
        return true;
      });
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw AI data:', aiData);
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