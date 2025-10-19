import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads an image to Supabase Storage if a file is provided.
 * Returns the storage path (e.g., "messages/<uid>/<id>.jpg") or null.
 */
export async function uploadImageIfAny(
  file: File | null,
  clientMsgId: string,
  senderId: string,
  bucket: string = "Uploads"
): Promise<string | null> {
  if (!file) return null;

  // Extract file extension
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  
  // Build storage path: messages/<senderId>/<clientMsgId>.<ext>
  const storagePath = `messages/${senderId}/${clientMsgId}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    throw uploadError;
  }

  // Return the storage path (not the full public URL)
  // The RLS policy will check this path against messages.image_url
  return storagePath;
}
