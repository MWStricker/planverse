import Tesseract from 'tesseract.js';

// Extract plain text from an image file using Tesseract.js (client-side)
// Optimized for speed with a single worker and default engine
export async function ocrExtractText(file: File): Promise<string> {
  const { data } = await Tesseract.recognize(file, 'eng', {
    // Keep logging minimal to avoid console noise
    logger: () => {},
  });
  // Trim and cap to avoid sending overly long prompts
  return (data.text || '').trim().slice(0, 20000);
}
