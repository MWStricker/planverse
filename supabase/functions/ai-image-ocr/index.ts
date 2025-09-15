import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { image, mimeType } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: 'Image data is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing image OCR request...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an intelligent note paraphrasing assistant. Your task is to:

1. Carefully examine the image and understand all visible text (handwritten, printed, diagrams, equations, etc.)
2. Paraphrase and improve the content to make it clearer and more organized
3. Maintain the key information and concepts but rewrite in your own words
4. Organize the content with better structure (bullet points, numbered lists, clear sections)
5. Fix any grammar, spelling, or clarity issues
6. Expand on abbreviations and make concepts clearer
7. Keep the same academic level and tone appropriate for studying

Transform the raw notes into polished, well-structured content that's easier to study from.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please read and understand all the text in this image, then paraphrase and improve it into well-structured, clear notes for studying.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log('OCR extraction completed successfully');

    return new Response(JSON.stringify({ extractedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-image-ocr function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});