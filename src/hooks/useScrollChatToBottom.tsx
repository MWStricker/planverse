import { useEffect, useRef } from "react";

type Opts = {
  containerRef: React.RefObject<HTMLElement>;
  bottomRef: React.RefObject<HTMLElement>;
  lastActionKey: string | number;
  enable?: boolean;
  pageBottomOffset?: number;
};

/**
 * Scrolls: (1) the thread container to bottom, then (2) the page viewport so
 * the bottom of the thread is on screen. Runs when lastActionKey changes.
 */
export function useScrollChatToBottom({
  containerRef,
  bottomRef,
  lastActionKey,
  enable = true,
  pageBottomOffset = 16,
}: Opts) {
  const ticking = useRef(false);

  useEffect(() => {
    if (!enable) return;
    const container = containerRef.current;
    const bottom = bottomRef.current;
    if (!container || !bottom) return;
    if (ticking.current) return;
    ticking.current = true;

    // Wait for DOM & images to paint
    const run = () => {
      // 1) Scroll the thread container itself
      container.scrollTop = container.scrollHeight;

      // 2) Ensure the thread's bottom is actually visible in the viewport
      //    If not, scroll the window just enough.
      const rect = bottom.getBoundingClientRect();
      const overshoot = rect.bottom + pageBottomOffset - window.innerHeight;

      if (overshoot > 0) {
        window.scrollBy({ top: overshoot, left: 0, behavior: "smooth" });
      } else if (rect.top < 0) {
        // If we're above, bring it into view
        bottom.scrollIntoView({ block: "end", behavior: "smooth" });
      }

      // Release tick after the smooth scroll kicks off
      setTimeout(() => (ticking.current = false), 150);
    };

    // Double rAF to catch layout after React commit + image sizing
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [lastActionKey, enable, containerRef, bottomRef, pageBottomOffset]);
}
