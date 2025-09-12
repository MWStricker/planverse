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
    console.log('Attempting to fetch Canvas dashboard for color extraction...');
    let courseColors: Record<string, string> = {};

    try {
      // Try multiple approaches to get Canvas colors
      courseColors = await extractCanvasColors(canvasBaseUrl, courseCodes);
      console.log('Extracted colors from Canvas:', courseColors);
    } catch (error) {
      console.log('Canvas color extraction failed, using intelligent defaults:', error.message);
      courseColors = getIntelligentColorMapping(courseCodes);
    }

    // If no colors were extracted, use intelligent defaults
    if (Object.keys(courseColors).length === 0) {
      console.log('No colors extracted, using intelligent course mapping');
      courseColors = getIntelligentColorMapping(courseCodes);
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

async function extractCanvasColors(canvasBaseUrl: string, courseCodes: string[]): Promise<Record<string, string>> {
  const courseColors: Record<string, string> = {};
  
  // Try multiple Canvas endpoints and methods
  const endpoints = [
    `${canvasBaseUrl}/`,
    `${canvasBaseUrl}/dashboard`,
    `${canvasBaseUrl}/courses`,
    `${canvasBaseUrl}/api/v1/courses?enrollment_state=active&include[]=course_image&include[]=term&per_page=100`
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const content = await response.text();
        
        // Try to extract colors from different Canvas UI patterns
        const extractedColors = await extractColorsFromCanvasContent(content, courseCodes);
        
        if (Object.keys(extractedColors).length > 0) {
          Object.assign(courseColors, extractedColors);
          console.log(`Successfully extracted ${Object.keys(extractedColors).length} colors from ${endpoint}`);
        }
      }
    } catch (error) {
      console.log(`Failed to fetch ${endpoint}:`, error.message);
      continue;
    }
  }

  return courseColors;
}

async function extractColorsFromCanvasContent(content: string, courseCodes: string[]): Promise<Record<string, string>> {
  const courseColors: Record<string, string> = {};
  
  // Different Canvas UI patterns to look for
  const patterns = [
    // Dashboard card patterns
    {
      regex: /<div[^>]*class="[^"]*ic-DashboardCard[^"]*"[^>]*>.*?<\/div>/gs,
      titleExtractor: (match: string) => {
        const titleMatch = match.match(/(?:title|aria-label|data-course-name)="([^"]*)"/i);
        return titleMatch ? titleMatch[1] : null;
      },
      colorExtractor: (match: string) => {
        const colorMatches = [
          match.match(/background-color:\s*([^;]+)/i),
          match.match(/border-color:\s*([^;]+)/i),
          match.match(/--course-color:\s*([^;]+)/i),
          match.match(/data-color="([^"]*)"/i)
        ];
        return colorMatches.find(match => match)?.[1]?.trim();
      }
    },
    // Course list patterns
    {
      regex: /<tr[^>]*class="[^"]*course[^"]*"[^>]*>.*?<\/tr>/gs,
      titleExtractor: (match: string) => {
        const titleMatch = match.match(/<a[^>]*>([^<]*)</);
        return titleMatch ? titleMatch[1] : null;
      },
      colorExtractor: (match: string) => {
        const colorMatch = match.match(/background:\s*([^;]+)/i) || match.match(/color:\s*([^;]+)/i);
        return colorMatch?.[1]?.trim();
      }
    },
    // Modern Canvas patterns
    {
      regex: /<div[^>]*data-testid="course-card"[^>]*>.*?<\/div>/gs,
      titleExtractor: (match: string) => {
        const titleMatch = match.match(/<h[1-6][^>]*>([^<]*)</);
        return titleMatch ? titleMatch[1] : null;
      },
      colorExtractor: (match: string) => {
        const styleMatch = match.match(/style="[^"]*background[^"]*([^"]*)/i);
        return styleMatch?.[1]?.trim();
      }
    }
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern.regex) || [];
    
    for (const match of matches) {
      const courseName = pattern.titleExtractor(match);
      const color = pattern.colorExtractor(match);
      
      if (courseName && color) {
        // Try to match this course name to our course codes
        for (const code of courseCodes) {
          if (courseName.includes(code) || 
              courseName.toLowerCase().includes(code.toLowerCase()) ||
              code.toLowerCase().includes(courseName.toLowerCase().replace(/[^a-z]/g, ''))) {
            
            // Clean and normalize the color
            const normalizedColor = normalizeColor(color);
            if (normalizedColor) {
              courseColors[code] = normalizedColor;
              console.log(`Matched course ${code} to color ${normalizedColor} from "${courseName}"`);
              break;
            }
          }
        }
      }
    }
  }

  return courseColors;
}

function normalizeColor(color: string): string | null {
  if (!color) return null;
  
  // Remove extra whitespace and quotes
  color = color.trim().replace(/['"]/g, '');
  
  // If it's already a hex color, return it
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }
  
  // Convert RGB to hex
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  
  // Convert common color names to hex
  const colorNames: Record<string, string> = {
    'red': '#E74C3C',
    'blue': '#3498DB',
    'green': '#27AE60',
    'orange': '#F39C12',
    'purple': '#9B59B6',
    'yellow': '#F1C40F',
    'pink': '#E91E63',
    'brown': '#8B4513',
    'gray': '#6C757D',
    'grey': '#6C757D',
    'black': '#2C3E50',
    'white': '#FFFFFF'
  };
  
  const lowerColor = color.toLowerCase();
  if (colorNames[lowerColor]) {
    return colorNames[lowerColor];
  }
  
  return null;
}

function getIntelligentColorMapping(courseCodes: string[]): Record<string, string> {
  const courseColors: Record<string, string> = {};
  
  // Intelligent color mapping based on common course patterns
  const intelligentMappings: Record<string, string> = {
    // Health & Medicine
    'HES': '#E74C3C', 'HLTH': '#E74C3C', 'NURS': '#E74C3C', 'MED': '#E74C3C',
    
    // Life Sciences & Biology
    'LIFE': '#27AE60', 'BIO': '#27AE60', 'BIOL': '#27AE60', 'LIFE-L': '#27AE60',
    'ANAT': '#27AE60', 'PHYSIOL': '#27AE60', 'MICRO': '#27AE60', 'ECOLOGY': '#27AE60',
    
    // Mathematics
    'MATH': '#8B4513', 'CALC': '#8B4513', 'ALGEBRA': '#8B4513', 'STAT': '#8B4513',
    'TRIG': '#8B4513', 'GEOMETRY': '#8B4513',
    
    // Music & Arts
    'MU': '#27AE60', 'MUSIC': '#27AE60', 'ART': '#E91E63', 'ARTS': '#E91E63',
    'FINE': '#E91E63', 'THEATER': '#E91E63', 'DRAMA': '#E91E63',
    
    // Psychology & Social Sciences
    'PSY': '#E74C3C', 'PSYC': '#E74C3C', 'SOC': '#9B59B6', 'ANTH': '#9B59B6',
    'PHIL': '#9B59B6', 'HIST': '#F39C12',
    
    // Physical Sciences
    'CHEM': '#3498DB', 'PHYS': '#3498DB', 'PHYSICS': '#3498DB', 'CHEMISTRY': '#3498DB',
    
    // Engineering & Technology
    'CS': '#2C3E50', 'CSE': '#2C3E50', 'COMP': '#2C3E50', 'IT': '#2C3E50',
    'ENG': '#34495E', 'ENGR': '#34495E', 'MECH': '#34495E', 'ELEC': '#34495E',
    
    // Business & Economics
    'BUS': '#1ABC9C', 'ECON': '#1ABC9C', 'FIN': '#1ABC9C', 'ACCT': '#1ABC9C',
    'MGMT': '#1ABC9C', 'MARK': '#1ABC9C',
    
    // Language & Literature
    'ENG': '#F39C12', 'ENGL': '#F39C12', 'LIT': '#F39C12', 'SPAN': '#E67E22',
    'FREN': '#E67E22', 'GERM': '#E67E22', 'LANG': '#E67E22',
    
    // Education
    'ED': '#95A5A6', 'EDUC': '#95A5A6', 'TEACH': '#95A5A6',
    
    // General/Liberal Arts
    'GEN': '#7F8C8D', 'LIBERAL': '#7F8C8D', 'CORE': '#7F8C8D'
  };
  
  for (const code of courseCodes) {
    // Direct match first
    if (intelligentMappings[code]) {
      courseColors[code] = intelligentMappings[code];
      continue;
    }
    
    // Pattern matching for course prefixes
    const prefix = code.split('-')[0];
    if (intelligentMappings[prefix]) {
      courseColors[code] = intelligentMappings[prefix];
      continue;
    }
    
    // Partial matching for common patterns
    let matched = false;
    for (const [pattern, color] of Object.entries(intelligentMappings)) {
      if (code.includes(pattern) || pattern.includes(code.split('-')[0])) {
        courseColors[code] = color;
        matched = true;
        break;
      }
    }
    
    // Generate consistent color if no match found
    if (!matched) {
      const colors = ['#E74C3C', '#3498DB', '#27AE60', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#E91E63'];
      let hash = 0;
      for (let i = 0; i < code.length; i++) {
        hash = ((hash << 5) - hash + code.charCodeAt(i)) & 0xffffffff;
      }
      courseColors[code] = colors[Math.abs(hash) % colors.length];
    }
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
