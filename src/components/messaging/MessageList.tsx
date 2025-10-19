import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  conversationId?: string;
  messages: any[];
  currentUserId: string;
  onMessageLongPress: (message: any, event: React.TouchEvent | React.MouseEvent) => void;
  onImageClick: (url: string) => void;
  onProfileClick: (userId: string) => void;
  onReactionClick: (messageId: string) => void;
  onReplyClick: (message: any) => void;
}

// Helper to determine if we should show avatar for this message
const shouldShowAvatar = (messages: any[], index: number, currentUserId: string) => {
  const currentMessage = messages[index];
  const isOwn = currentMessage.sender_id === currentUserId;
  
  // Never show avatar for own messages
  if (isOwn) return false;
  
  // Always show avatar for the first message
  if (index === 0) return true;
  
  // Show avatar if next message is from a different sender or doesn't exist
  const nextMessage = messages[index + 1];
  if (!nextMessage || nextMessage.sender_id !== currentMessage.sender_id) {
    return true;
  }
  
  return false;
};

export function MessageList({ 
  conversationId,
  messages, 
  currentUserId,
  onMessageLongPress,
  onImageClick,
  onProfileClick,
  onReactionClick,
  onReplyClick
}: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const BOTTOM_THRESHOLD = 80; // pixels

  const scrollToBottom = (smooth = false) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Track if user is near bottom
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= BOTTOM_THRESHOLD);
  };

  // 1) On conversation change, jump to bottom once content renders
  useLayoutEffect(() => {
    requestAnimationFrame(() => scrollToBottom(false));
  }, [conversationId]);

  // 2) When messages change, if user is at bottom, keep them at bottom
  useLayoutEffect(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages.length]);

  // 3) If messages contain images, re-scroll when they finish loading
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const imgs = Array.from(el.querySelectorAll("img"));
    if (!imgs.length) return;

    let remaining = imgs.length;
    const maybeScroll = () => {
      remaining -= 1;
      if (remaining <= 0 && isAtBottom) {
        scrollToBottom(false);
      }
    };

    imgs.forEach((img) => {
      if (img.complete) {
        maybeScroll();
      } else {
        img.addEventListener("load", maybeScroll, { once: true });
        img.addEventListener("error", maybeScroll, { once: true });
      }
    });

    return () => {
      imgs.forEach((img) => {
        img.removeEventListener("load", maybeScroll);
        img.removeEventListener("error", maybeScroll);
      });
    };
  }, [messages, isAtBottom]);

  return (
    <div 
      ref={scrollerRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto flex-1"
    >
      <div className="flex flex-col gap-1 px-4 py-2">
        {messages.map((message, index) => {
          const isMe = message.sender_id === currentUserId;
          const isDeleted = message.deleted_at !== null;
          const showAvatar = shouldShowAvatar(messages, index, currentUserId);
          
          return (
            <div key={message.id}>
              <MessageBubble
                message={message}
                isOwn={isMe}
                isTemp={false}
                onLongPress={() => onMessageLongPress(message, {} as any)}
                onImageClick={onImageClick}
                onReactionClick={onReactionClick}
                showAvatar={showAvatar}
                onAvatarClick={() => onProfileClick(message.sender_id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
