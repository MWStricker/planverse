import { supabase } from "@/integrations/supabase/client";

type Cache = Map<string, string | null>;
const urlCache: Cache = new Map();

/**
 * Get a displayable avatar URL for a user.
 * Works with both public buckets (getPublicUrl) and private buckets (createSignedUrl).
 * Caches by user_id to avoid thrash.
 */
export async function getAvatarUrl(
  userId: string,
  opts?: { bucket?: string; path?: string | null; isPublic?: boolean; expiresIn?: number }
): Promise<string | null> {
  if (!userId) return null;

  // Return cached if we have it
  if (urlCache.has(userId)) return urlCache.get(userId)!;

  // 1) Read the profile record with the avatar path
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("getAvatarUrl: profile select failed", error);
    urlCache.set(userId, null);
    return null;
  }

  const bucket = opts?.bucket ?? "Uploads";
  let path = opts?.path ?? profile?.avatar_url;

  if (!path) {
    urlCache.set(userId, null);
    return null;
  }

  // Normalize: extract path from full URL if needed
  if (path.includes('/object/public/') || path.includes('/object/sign/')) {
    path = path.replace(/^.*\/object\/(public|sign)\/[^/]+\//, "");
  }

  // 2) Build a usable URL depending on bucket privacy
  const isPublic = opts?.isPublic ?? true;
  if (isPublic) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = data?.publicUrl ?? null;
    urlCache.set(userId, url);
    return url;
  } else {
    const expiresIn = opts?.expiresIn ?? 3600; // 1 hour
    const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (signErr) {
      console.warn("getAvatarUrl: signed url failed", signErr);
      urlCache.set(userId, null);
      return null;
    }
    const url = data?.signedUrl ?? null;
    urlCache.set(userId, url);
    return url;
  }
}

/** Let you refresh a single user's cached URL (e.g., after they change photo) */
export function bustAvatarCache(userId: string) {
  urlCache.delete(userId);
}

/** Clear all cached avatar URLs */
export function clearAvatarCache() {
  urlCache.clear();
}
