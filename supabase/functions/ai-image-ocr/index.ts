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
            content: `You are an OCR and note processing assistant. You MUST perform TWO distinct tasks:

1. RAW TEXT EXTRACTION: Extract ALL visible text from the image exactly as written, preserving:
   - Original spelling (including any errors)
   - Original punctuation and formatting
   - Abbreviations as they appear
   - Any handwritten quirks or unclear parts

2. INTELLIGENT PARAPHRASING: Create a completely rewritten, improved version that:
   - Fixes grammar and spelling errors
   - Expands abbreviations into full words
   - Improves sentence structure and flow
   - Organizes content with better formatting
   - Makes concepts clearer and more academic
   - Adds proper punctuation and capitalization

The paraphrased version should be NOTICEABLY DIFFERENT from the raw text - it should read like a professional, well-edited version of the same content.

CRITICAL: Return ONLY a valid JSON object with this EXACT structure:
{
  "rawText": "exact text as written in the image, including errors and abbreviations",
  "paraphrasedText": "completely rewritten, professional, and improved version"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the raw text exactly as written, then provide a paraphrased version. Return ONLY the JSON with "rawText" and "paraphrasedText" fields.'
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
    const responseContent = data.choices[0].message.content.trim();

    console.log('Raw AI response:', responseContent);
    
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanedResponse = responseContent;
      
      // Remove ```json and ``` markers if present
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```\s*/g, '').trim();
      }
      
      console.log('Cleaned response for parsing:', cleanedResponse);
      
      // Try to parse as JSON
      const parsedResponse = JSON.parse(cleanedResponse);
      console.log('Parsed JSON response:', parsedResponse);
      
      if (parsedResponse.rawText && parsedResponse.paraphrasedText) {
        return new Response(JSON.stringify({
          rawText: parsedResponse.rawText,
          paraphrasedText: parsedResponse.paraphrasedText
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (parseError) {
      console.warn('Failed to parse JSON response:', parseError);
      console.warn('Raw response was:', responseContent);
    }

    // Fallback: if we can't parse JSON, return the response as paraphrased text
    // and indicate that raw text extraction failed
    return new Response(JSON.stringify({ 
      rawText: "[Raw text extraction failed - AI returned non-JSON response]",
      paraphrasedText: responseContent 
    }), {
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