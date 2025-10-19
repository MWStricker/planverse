import { useEffect, useRef } from "react";
import { scrollToLastMessage } from "@/utils/scrollToLastMessage";

type Opts = {
  selectedConversationId?: string | null;
  messagesCount: number;
  containerRef: React.RefObject<HTMLElement>;
  bottomRef: React.RefObject<HTMLElement>;
  pageBottomOffset?: number;
};

/**
 * Auto-scrolls to the bottom when a conversation is opened.
 * Uses double rAF + timeout to wait for images to load.
 */
export function useScrollOnConversationOpen({
  selectedConversationId,
  messagesCount,
  containerRef,
  bottomRef,
  pageBottomOffset = 24,
}: Opts) {
  const hasScrolledRef = useRef(false);

  // Reset flag when conversation changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !messagesCount) return;
    if (hasScrolledRef.current) return; // Already scrolled for this conversation

    const run = () => {
      scrollToLastMessage(
        containerRef.current,
        bottomRef.current,
        pageBottomOffset
      );
      hasScrolledRef.current = true;
    };

    // Double rAF + micro timeout to catch image decode/layout
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        run();
        setTimeout(run, 50);
      })
    );
  }, [selectedConversationId, messagesCount, containerRef, bottomRef, pageBottomOffset]);
}
