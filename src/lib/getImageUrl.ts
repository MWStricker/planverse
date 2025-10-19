import { supabase } from "@/integrations/supabase/client";

/**
 * Converts a storage path to a public URL for display.
 * Returns null if no path is provided.
 */
export function getImageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return supabase.storage.from('Uploads').getPublicUrl(storagePath).data.publicUrl;
}
