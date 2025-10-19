import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
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
  messages, 
  currentUserId,
  onMessageLongPress,
  onImageClick,
  onProfileClick,
  onReactionClick,
  onReplyClick
}: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll to bottom when new messages arrive
    ref.current?.lastElementChild?.scrollIntoView({ 
      behavior: "smooth", 
      block: "end" 
    });
  }, [messages.length]);

  return (
    <div ref={ref} className="flex flex-col gap-1 p-3">
      {messages.map((message, index) => {
        const isMe = message.sender_id === currentUserId;
        const isDeleted = message.deleted_at !== null;
        const showAvatar = shouldShowAvatar(messages, index, currentUserId);
        
        return (
          <div 
            key={message.id} 
            className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
          >
            <motion.div
              initial={{ opacity: 0, x: isMe ? 24 : -24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="w-full"
            >
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
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
