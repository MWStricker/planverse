import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Compress an image file on the client and return base64 (no data URL prefix)
export async function imageFileToBase64Compressed(
  file: File,
  maxDimension = 1600,
  outputMime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.8
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();

    reader.onload = () => {
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        // Maintain aspect ratio, cap by maxDimension
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(outputMime, quality);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, mimeType: outputMime });
      };
      img.onerror = (e) => reject(e);
      img.src = reader.result as string;
    };

    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

