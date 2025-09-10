import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisType, data } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    let prompt = '';
    let systemPrompt = 'You are an AI academic scheduler assistant that analyzes schedules, tasks, and events to provide intelligent insights and recommendations.';

    switch (analysisType) {
      case 'daily_schedule':
        prompt = `Analyze this academic data and create an optimized daily schedule for today. 
        Events: ${JSON.stringify(data.events || [])}
        Tasks: ${JSON.stringify(data.tasks || [])}
        Study Sessions: ${JSON.stringify(data.studySessions || [])}
        
        Return a JSON object with:
        - todaySchedule: array of today's events with times
        - priorityInsights: array of priority tasks with reasoning
        - studyBlockSuggestions: 3 optimal study time suggestions
        - weeklyAnalysis: insights about the upcoming week`;
        break;

      case 'priority_analysis':
        prompt = `Analyze these academic tasks and assignments to determine priority levels:
        Tasks: ${JSON.stringify(data.tasks || [])}
        Upcoming Events: ${JSON.stringify(data.events || [])}
        
        Return a JSON object with tasks ranked by priority, including:
        - id: task identifier
        - priority: high/medium/low
        - reasoning: why this priority was assigned
        - suggestedTimeSlot: when to work on this
        - estimatedHours: time needed`;
        break;

      case 'image_ocr':
        prompt = `Extract schedule information from this image description: "${data.imageDescription}"
        
        Return a JSON object with:
        - events: array of extracted events with title, date, startTime, endTime, location, recurrence
        - confidence: confidence score for each event (0-100)
        - suggestions: additional insights about the schedule`;
        break;

      default:
        throw new Error('Invalid analysis type');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const analysis = aiData.choices[0].message.content;

    // Try to parse as JSON, fallback to text response
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysis);
    } catch {
      parsedAnalysis = { analysis, rawText: true };
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: parsedAnalysis,
      analysisType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI analysis:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});