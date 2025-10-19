import { useState, useEffect } from "react";
import { getAvatarUrl } from "@/lib/avatar";

interface UseAvatarUrlOptions {
  bucket?: string;
  path?: string | null;
  isPublic?: boolean;
  expiresIn?: number;
}

export function useAvatarUrl(
  userId: string | undefined | null,
  opts?: UseAvatarUrlOptions
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUrl(null);
      return;
    }

    let mounted = true;

    (async () => {
      const avatarUrl = await getAvatarUrl(userId, opts);
      if (mounted) setUrl(avatarUrl);
    })();

    return () => {
      mounted = false;
    };
  }, [userId, opts?.bucket, opts?.isPublic]);

  return url;
}
