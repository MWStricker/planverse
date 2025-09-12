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

    console.log('Processing Canvas ICS URL:', icsUrl);

    // Extract the Canvas domain and user info from ICS URL
    const canvasUrlMatch = icsUrl.match(/(https:\/\/[^\/]+)/);
    if (!canvasUrlMatch) {
      throw new Error('Invalid Canvas ICS URL format');
    }

    const canvasBaseUrl = canvasUrlMatch[1];
    console.log('Canvas base URL:', canvasBaseUrl);

    // First, fetch the ICS feed to get course information
    console.log('Fetching ICS feed...');
    const icsResponse = await fetch(icsUrl);
    if (!icsResponse.ok) {
      throw new Error(`Failed to fetch ICS feed: ${icsResponse.statusText}`);
    }

    const icsData = await icsResponse.text();
    console.log('ICS data length:', icsData.length);

    // Extract course codes from ICS data
    const courseCodes = extractCourseCodesFromICS(icsData);
    console.log('Extracted course codes from ICS:', courseCodes);

    // Now try to get color information from Canvas dashboard
    console.log('Attempting to fetch Canvas dashboard...');
    let courseColors: Record<string, string> = {};

    try {
      // Try to access Canvas dashboard page (this may require authentication)
      const dashboardUrl = `${canvasBaseUrl}/`;
      const dashboardResponse = await fetch(dashboardUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (dashboardResponse.ok) {
        const dashboardHtml = await dashboardResponse.text();
        courseColors = extractColorsFromDashboard(dashboardHtml, courseCodes);
        console.log('Extracted colors from dashboard:', courseColors);
      } else {
        console.log('Could not access dashboard, using predefined color mapping');
        courseColors = getColorMappingByCourseType(courseCodes);
      }
    } catch (error) {
      console.log('Dashboard fetch failed, using predefined color mapping:', error.message);
      courseColors = getColorMappingByCourseType(courseCodes);
    }

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
    console.error('Error processing Canvas colors:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process Canvas colors', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function extractCourseCodesFromICS(icsData: string): string[] {
  const courseCodes = new Set<string>();
  const lines = icsData.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      const title = line.substring(8).trim();
      const courseCode = extractCourseCode(title);
      if (courseCode) {
        courseCodes.add(courseCode);
      }
    }
  }
  
  return Array.from(courseCodes);
}

function extractColorsFromDashboard(html: string, courseCodes: string[]): Record<string, string> {
  const courseColors: Record<string, string> = {};
  
  // Try to extract colors from Canvas dashboard HTML
  // Look for course cards with color information
  const courseCardRegex = /<div[^>]*class="[^"]*ic-DashboardCard[^"]*"[^>]*>.*?<\/div>/gs;
  const matches = html.match(courseCardRegex) || [];
  
  for (const match of matches) {
    // Extract course name and color from the card HTML
    const courseNameMatch = match.match(/title="([^"]*)/);
    const colorMatch = match.match(/background-color:\s*([^;]+)/i) || 
                      match.match(/color:\s*([^;]+)/i) ||
                      match.match(/style="[^"]*background:\s*([^;]+)/i);
    
    if (courseNameMatch && colorMatch) {
      const courseName = courseNameMatch[1];
      const color = colorMatch[1].trim();
      
      // Try to match this course name to our course codes
      for (const code of courseCodes) {
        if (courseName.includes(code) || courseName.toLowerCase().includes(code.toLowerCase())) {
          courseColors[code] = color;
          break;
        }
      }
    }
  }
  
  // If we couldn't extract from HTML, fall back to predefined mapping
  if (Object.keys(courseColors).length === 0) {
    return getColorMappingByCourseType(courseCodes);
  }
  
  return courseColors;
}

function getColorMappingByCourseType(courseCodes: string[]): Record<string, string> {
  const courseColors: Record<string, string> = {};
  
  // Based on your specific course color requirements
  const colorMappings: Record<string, string> = {
    // Your specific courses
    'HES': '#E74C3C',        // Red for Health courses
    'LIFE': '#27AE60',       // Green for Life/Biology courses  
    'LIFE-L': '#27AE60',     // Green for Life/Biology lab
    'MATH': '#8B4513',       // Brown for Math courses
    'MU': '#27AE60',         // Green for Music courses
    'PSY': '#E74C3C',        // Red for Psychology courses
    
    // General patterns for other courses
    'BIO': '#27AE60',        // Green for Biology
    'CHEM': '#3498DB',       // Blue for Chemistry
    'PHYS': '#9B59B6',       // Purple for Physics
    'ENG': '#F39C12',        // Orange for English
    'HIST': '#E67E22',       // Dark Orange for History
    'ECON': '#1ABC9C',       // Turquoise for Economics
    'PHIL': '#34495E',       // Dark Blue for Philosophy
    'ART': '#E91E63',        // Pink for Art
    'CS': '#2C3E50',         // Dark gray for Computer Science
    'STAT': '#95A5A6',       // Gray for Statistics
  };
  
  for (const code of courseCodes) {
    // Direct match first
    if (colorMappings[code]) {
      courseColors[code] = colorMappings[code];
      continue;
    }
    
    // Pattern matching for course prefixes
    const prefix = code.split('-')[0];
    if (colorMappings[prefix]) {
      courseColors[code] = colorMappings[prefix];
      continue;
    }
    
    // Default color if no match
    courseColors[code] = '#6C757D'; // Default gray
  }
  
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
