import { useEffect, useMemo, useRef, useCallback } from "react";

type Message = {
  id: string;
  sender_id: string;
  content?: string | null;
  image_url?: string | null;
};

export function useScrollToBottomOnOwnSend(
  containerRef: React.RefObject<HTMLElement>,
  messages: Message[],
  currentUserId: string
) {
  const endRef = useRef<HTMLDivElement | null>(null);

  // Find the last message sent by the current user
  const lastOwnMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === currentUserId) return messages[i];
    }
    return null;
  }, [messages, currentUserId]);

  const scrollToBottomNow = useCallback((smooth = true) => {
    // Prefer sentinel element for reliable positioning
    if (endRef.current) {
      endRef.current.scrollIntoView({ 
        behavior: smooth ? "smooth" : "auto", 
        block: "end" 
      });
      return;
    }
    // Fallback to container scroll
    const el = containerRef.current as HTMLElement | null;
    if (el) {
      el.scrollTo({ 
        top: el.scrollHeight, 
        behavior: smooth ? "smooth" : "auto" 
      });
    }
  }, [containerRef]);

  // Track the ID of the last processed own message
  const lastOwnIdRef = useRef<string | null>(null);

  useEffect(() => {
    const newId = lastOwnMsg?.id ?? null;
    
    // Only scroll if this is a NEW own message (not a re-render)
    if (newId && newId !== lastOwnIdRef.current) {
      lastOwnIdRef.current = newId;

      // Scroll immediately to get close
      scrollToBottomNow(true);

      // If message has images, re-scroll after they load
      const container = containerRef.current;
      if (!container) return;

      const imgs = Array.from(
        container.querySelectorAll<HTMLImageElement>(
          `[data-mid="${newId}"] img, img[data-mid="${newId}"]`
        )
      );
      
      if (!imgs.length) return;

      let remaining = imgs.length;
      const onDone = () => {
        remaining -= 1;
        if (remaining <= 0) scrollToBottomNow(false);
      };

      imgs.forEach((img) => {
        if (img.complete) {
          onDone();
        } else {
          img.addEventListener("load", onDone, { once: true });
          img.addEventListener("error", onDone, { once: true });
        }
      });

      // Cleanup
      return () => {
        imgs.forEach((img) => {
          img.removeEventListener("load", onDone);
          img.removeEventListener("error", onDone);
        });
      };
    }
  }, [lastOwnMsg, containerRef, scrollToBottomNow]);

  return { endRef, scrollToBottomNow };
}
