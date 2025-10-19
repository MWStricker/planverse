import { supabase } from "@/integrations/supabase/client";

/**
 * Converts a storage path to a public URL for display.
 * Supports signed URLs for private buckets.
 * Returns null if no path is provided.
 */
export async function getImageUrl(
  storagePath: string | null | undefined,
  signed: boolean = false
): Promise<string | null> {
  if (!storagePath) return null;
  
  if (signed) {
    const { data, error } = await supabase.storage
      .from('Uploads')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data?.signedUrl || null;
  }
  
  return supabase.storage.from('Uploads').getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Synchronous version for public buckets only.
 * Use getImageUrl() for signed URL support.
 */
export function getImageUrlSync(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return supabase.storage.from('Uploads').getPublicUrl(storagePath).data.publicUrl;
}
