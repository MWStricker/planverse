import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { icsUrl, userId } = await req.json();

    if (!icsUrl || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing icsUrl or userId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Fetching ICS feed from:', icsUrl);

    // Fetch the ICS feed
    const icsResponse = await fetch(icsUrl);
    if (!icsResponse.ok) {
      throw new Error(`Failed to fetch ICS feed: ${icsResponse.statusText}`);
    }

    const icsData = await icsResponse.text();
    console.log('ICS data length:', icsData.length);

    // Parse ICS data for course colors
    const courseColors = extractCourseColors(icsData);
    console.log('Extracted course colors:', courseColors);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store course colors in database
    for (const [courseCode, color] of Object.entries(courseColors)) {
      const { error } = await supabase
        .from('course_colors')
        .upsert(
          { 
            user_id: userId, 
            course_code: courseCode, 
            canvas_color: color 
          },
          { 
            onConflict: 'user_id,course_code',
            ignoreDuplicates: false 
          }
        );

      if (error) {
        console.error('Error storing course color:', error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        courseColors,
        message: `Updated colors for ${Object.keys(courseColors).length} courses`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing ICS feed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process ICS feed', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function extractCourseColors(icsData: string): Record<string, string> {
  const courseColors: Record<string, string> = {};
  const lines = icsData.split('\n');
  
  let currentEvent: any = {};
  let inEvent = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (trimmedLine === 'END:VEVENT') {
      inEvent = false;
      
      // Process the completed event
      if (currentEvent.summary && currentEvent.color) {
        const courseCode = extractCourseCode(currentEvent.summary);
        if (courseCode) {
          courseColors[courseCode] = currentEvent.color;
        }
      }
    } else if (inEvent) {
      // Parse event properties
      if (trimmedLine.startsWith('SUMMARY:')) {
        currentEvent.summary = trimmedLine.substring(8);
      } else if (trimmedLine.startsWith('X-APPLE-CALENDAR-COLOR:')) {
        currentEvent.color = trimmedLine.substring(24);
      } else if (trimmedLine.startsWith('COLOR:')) {
        currentEvent.color = trimmedLine.substring(6);
      } else if (trimmedLine.startsWith('CATEGORIES:')) {
        // Sometimes color info is in categories
        const categories = trimmedLine.substring(11);
        // Check if categories contain color information
        const colorMatch = categories.match(/#([A-Fa-f0-9]{6})/);
        if (colorMatch) {
          currentEvent.color = colorMatch[1];
        }
      }
    }
  }

  // If no explicit colors found, assign Canvas default colors based on course code
  const events = [];
  let currentEventTemp: any = {};
  let inEventTemp = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === 'BEGIN:VEVENT') {
      inEventTemp = true;
      currentEventTemp = {};
    } else if (trimmedLine === 'END:VEVENT') {
      inEventTemp = false;
      if (currentEventTemp.summary) {
        events.push(currentEventTemp);
      }
    } else if (inEventTemp && trimmedLine.startsWith('SUMMARY:')) {
      currentEventTemp.summary = trimmedLine.substring(8);
    }
  }

  // Assign consistent colors to courses
  const canvasColors = [
    '#E74C3C', // Red
    '#3498DB', // Blue  
    '#2ECC71', // Green
    '#F39C12', // Orange
    '#9B59B6', // Purple
    '#1ABC9C', // Turquoise
    '#34495E', // Dark Blue
    '#E67E22', // Dark Orange
    '#8E44AD', // Dark Purple
    '#27AE60', // Dark Green
    '#2980B9', // Dark Blue
    '#C0392B'  // Dark Red
  ];

  const courseCodes = new Set();
  events.forEach(event => {
    const courseCode = extractCourseCode(event.summary);
    if (courseCode) {
      courseCodes.add(courseCode);
    }
  });

  const sortedCourses = Array.from(courseCodes).sort();
  sortedCourses.forEach((courseCode, index) => {
    if (!courseColors[courseCode as string]) {
      courseColors[courseCode as string] = canvasColors[index % canvasColors.length];
    }
  });

  console.log('Final course colors:', courseColors);
  return courseColors;
}

function extractCourseCode(title: string): string | null {
  if (!title) return null;
  
  // Enhanced patterns for Canvas course extraction
  const patterns = [
    // [2025FA-PSY-100-007] or [2025FA-LIFE-102-003] format
    /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)\]/i,
    // [PSY-100-007-2025FA] format
    /\[([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)-(\d{4}[A-Z]{2})\]/i,
    // Simple course codes like PSY-100, MATH-118, LIFE-102, etc.
    /\b([A-Z]{2,4}-?\d{3,4}[A-Z]?)\b/i,
    // Lab courses like LIFE-102-L16
    /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}-?L\d*)\]/i
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      // Return the course code, cleaning up any extra formatting
      let courseCode = match[2] || match[1];
      // Remove semester info and normalize format
      courseCode = courseCode.replace(/\d{4}[A-Z]{2}/, '').replace(/^-|-$/, '');
      
      // Handle lab courses - keep the L designation but remove section numbers
      if (courseCode.includes('-L')) {
        courseCode = courseCode.replace(/-L\d+$/, '-L');
      }
      // If it's a regular course with section number, keep just the base course
      else if (courseCode.match(/^[A-Z]{2,4}-?\d{3,4}-\d{3}$/i)) {
        courseCode = courseCode.replace(/-\d{3}$/, '');
      }
      
      return courseCode.toUpperCase();
    }
  }
  
  return null;
}
