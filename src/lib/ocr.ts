import Tesseract from 'tesseract.js';

// Preprocess image for better OCR accuracy
function preprocessImage(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Convert to grayscale and increase contrast
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    
    // Increase contrast by making dark pixels darker and light pixels lighter
    const contrast = avg < 128 ? Math.max(0, avg - 30) : Math.min(255, avg + 30);
    
    data[i] = contrast;     // red
    data[i + 1] = contrast; // green
    data[i + 2] = contrast; // blue
    // alpha channel stays the same
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// Extract plain text from an image file using Tesseract.js with enhanced preprocessing
export async function ocrExtractText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        // Create canvas for image preprocessing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        // Scale image if too large (max 2000px width for better performance)
        const scale = Math.min(1, 2000 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw and preprocess image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        preprocessImage(canvas, ctx);
        
        // Convert canvas to blob for Tesseract
        canvas.toBlob(async (blob) => {
          if (!blob) {
            throw new Error('Could not convert canvas to blob');
          }
          
          const { data } = await Tesseract.recognize(blob, 'eng', {
            logger: () => {}, // Keep logging minimal
          });
          
          // Clean up the text and return
          const cleanText = (data.text || '')
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n\s*\n/g, '\n') // Remove empty lines
            .trim()
            .slice(0, 20000);
            
          resolve(cleanText);
        }, 'image/png', 0.95);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
