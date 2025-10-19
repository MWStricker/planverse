import { useEffect, useState } from "react";
import { getAvatarUrl } from "@/lib/avatar";

export function SmartAvatar({
  userId,
  name,
  size = 40,
  className = "",
  bucket = "Uploads",
  isPublic = true,
}: {
  userId: string;
  name?: string | null;
  size?: number;
  className?: string;
  bucket?: string;
  isPublic?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setFailed(false);
    (async () => {
      const url = await getAvatarUrl(userId, { bucket, isPublic });
      if (mounted) setSrc(url);
    })();
    return () => {
      mounted = false;
    };
  }, [userId, bucket, isPublic]);

  const initials =
    (name ?? "")
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "•";

  // If src is empty string, browsers render it as a blank/broken image.
  // We render the fallback instead until we have a non-empty URL.
  const showImage = !!src && !failed;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-label={name ?? "avatar"}
    >
      {showImage ? (
        <img
          src={src!}
          alt={name ?? ""}
          className="w-full h-full object-cover rounded-full"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-medium select-none">{initials}</span>
      )}
    </div>
  );
}
