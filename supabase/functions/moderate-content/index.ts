import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModerationResult {
  score: number;
  flags: string[];
  reasoning: string;
  status: 'approved' | 'flagged' | 'auto_hidden';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, contentType, contentId } = await req.json();
    
    if (!content || !contentType || !contentId) {
      throw new Error('Missing required fields');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Call Lovable AI for content moderation
    const moderationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a content moderation AI. Analyze content for:
1. Hate speech or discrimination
2. Harassment or bullying
3. Violence or threats
4. Sexual content
5. Spam or scams
6. Misinformation

Return ONLY a JSON object with this exact structure:
{
  "score": <0-100>,
  "flags": [<array of detected issues>],
  "reasoning": "<brief explanation>"
}

Scoring:
- 0-50: Clean content
- 51-80: Questionable, flag for review
- 81-100: Harmful, auto-hide`
          },
          {
            role: 'user',
            content: `Moderate this ${contentType}: "${content}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      }),
    });

    if (!moderationResponse.ok) {
      const errorText = await moderationResponse.text();
      console.error('AI moderation error:', errorText);
      throw new Error(`AI moderation failed: ${moderationResponse.status}`);
    }

    const aiResult = await moderationResponse.json();
    const resultText = aiResult.choices[0]?.message?.content || '{}';
    
    // Parse JSON from AI response
    let parsed: any;
    try {
      // Remove markdown code blocks if present
      const cleanJson = resultText.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.error('Failed to parse AI response:', resultText);
      // Fallback to manual approval
      parsed = { score: 50, flags: [], reasoning: 'Failed to parse AI response' };
    }

    const score = Math.min(100, Math.max(0, parsed.score || 50));
    const flags = Array.isArray(parsed.flags) ? parsed.flags : [];
    const reasoning = parsed.reasoning || 'No reasoning provided';

    // Determine moderation status
    let status: 'approved' | 'flagged' | 'auto_hidden';
    if (score > 80) {
      status = 'auto_hidden';
    } else if (score > 50) {
      status = 'flagged';
    } else {
      status = 'approved';
    }

    const result: ModerationResult = {
      score,
      flags,
      reasoning,
      status
    };

    // Get authenticated user from request
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract user from auth header
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const supabaseClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseClient.auth.getUser();
      userId = user?.id || null;
    }

    // Update content moderation status
    const updateData = {
      moderation_status: status,
      moderation_score: score,
      moderation_flags: flags,
      moderated_at: new Date().toISOString()
    };

    const table = contentType === 'post' ? 'posts' : 'comments';
    await supabase
      .from(table)
      .update(updateData)
      .eq('id', contentId);

    // Log moderation action
    if (userId) {
      await supabase
        .from('moderation_logs')
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          action: 'auto_moderate',
          moderation_score: score,
          moderation_flags: flags,
          ai_reasoning: reasoning
        });
    }

    console.log(`Moderated ${contentType} ${contentId}: score=${score}, status=${status}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Moderation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});