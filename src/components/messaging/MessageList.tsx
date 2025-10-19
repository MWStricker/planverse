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
      {messages.map((message) => {
        const isMe = message.sender_id === currentUserId;
        const isDeleted = message.deleted_at !== null;
        
        return (
          <div 
            key={message.id} 
            className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
          >
            <motion.div
              initial={{ opacity: 0, x: isMe ? 24 : -24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="max-w-[75%]"
            >
              <MessageBubble
                message={message}
                isOwn={isMe}
                isTemp={false}
                onLongPress={() => onMessageLongPress(message, {} as any)}
                onImageClick={onImageClick}
                onReactionClick={onReactionClick}
              />
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
