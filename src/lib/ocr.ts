import { supabase } from "@/integrations/supabase/client";

// Convert image file to base64 for API submission
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 data
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extract text from image using OpenAI Vision API (much more accurate for handwritten notes)
export async function ocrExtractText(file: File): Promise<string> {
  try {
    // Convert image to base64
    const base64Image = await imageToBase64(file);
    
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

    return data?.extractedText || '';
  } catch (error) {
    console.error('Error in OCR:', error);
    throw error;
  }
}
