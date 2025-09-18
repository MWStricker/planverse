import { supabase } from "@/integrations/supabase/client";
import { fileToBase64 } from "@/lib/utils";

// Extract text from image using OpenAI Vision API (much more accurate for handwritten notes)
export async function ocrExtractText(file: File): Promise<{ rawText: string; paraphrasedText: string }> {
  try {
    // Convert image to base64
    const base64Image = await fileToBase64(file);
    
    // Call our edge function that uses OpenAI Vision
    const { data, error } = await supabase.functions.invoke('ai-image-ocr', {
      body: { 
        image: base64Image,
        mimeType: file.type
      }
    });

    if (error) {
      console.error('OCR error:', error);
      throw new Error('Failed to extract text from image');
    }

    return {
      rawText: data?.rawText || '',
      paraphrasedText: data?.paraphrasedText || ''
    };
  } catch (error) {
    console.error('Error in OCR:', error);
    throw error;
  }
}
