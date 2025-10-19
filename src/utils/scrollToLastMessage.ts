/**
 * Scrolls both the container and viewport to show the bottom of a conversation.
 * Uses dual-scope scrolling to ensure the last message is visible on screen.
 */
export function scrollToLastMessage(
  containerEl: HTMLElement | null,
  bottomAnchorEl: HTMLElement | null,
  pageBottomOffset = 24 // adjust for sticky input/footer height
) {
  if (!containerEl || !bottomAnchorEl) return;

  // 1) Push the scrollable thread to the bottom
  containerEl.scrollTop = containerEl.scrollHeight;

  // 2) Ensure the viewport shows the bottom of the thread
  const rect = bottomAnchorEl.getBoundingClientRect();
  const overshoot = rect.bottom + pageBottomOffset - window.innerHeight;

  if (overshoot > 0) {
    // Bottom is below viewport - scroll window down
    window.scrollBy({ top: overshoot, left: 0, behavior: "smooth" });
  } else if (rect.top < 0) {
    // Bottom is above viewport - bring it into view
    bottomAnchorEl.scrollIntoView({ block: "end", behavior: "smooth" });
  }
}
