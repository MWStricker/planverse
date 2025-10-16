import { useState } from 'react';
import { Message } from '@/hooks/useMessaging';
import { useReactions } from '@/hooks/useReactions';
import { ReactionBar } from './ReactionBar';
import { ReactionPill } from './ReactionPill';
import { formatDistanceToNow } from 'date-fns';
import { Check } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isTemp: boolean;
  onImageClick: (url: string) => void;
  onLongPress: (message: Message) => void;
  onReactionClick: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  isPinned?: boolean;
}

export const MessageBubble = ({
  message,
  isOwn,
  isTemp,
  onImageClick,
  onLongPress,
  onReactionClick
}: MessageBubbleProps) => {
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const { reactions, addReaction } = useReactions(message.id);

  const handleMouseDown = () => {
    const timer = setTimeout(() => {
      onLongPress(message);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleReact = async (emoji: string) => {
    await addReaction(message.id, emoji);
    setShowReactionBar(false);
  };

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      <div className={`max-w-[70%] w-fit relative ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* Reaction Bar */}
        {showReactionBar && (
          <div className={`absolute -top-12 ${isOwn ? 'right-0' : 'left-0'} z-10`}>
            <ReactionBar
              onReact={handleReact}
              className="shadow-xl"
            />
          </div>
        )}

        <div
          className={`rounded-lg px-3 py-2 inline-flex flex-col break-words overflow-wrap-anywhere ${
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          } ${isTemp ? 'opacity-70' : ''}`}
          onDoubleClick={() => setShowReactionBar(!showReactionBar)}
        >
          {message.image_url && (
            <div 
              className="cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onImageClick(message.image_url!)}
            >
              <img
                src={message.image_url}
                alt="Message attachment"
                className="w-full rounded-md mb-2 max-h-48 object-cover hover:scale-[1.02] transition-transform"
              />
            </div>
          )}
          <p className="text-sm break-words overflow-wrap-anywhere hyphens-auto">{message.content}</p>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((reaction) => (
              <ReactionPill
                key={reaction.emoji}
                emoji={reaction.emoji}
                count={reaction.count}
                userReacted={reaction.userReacted}
                onClick={() => handleReact(reaction.emoji)}
              />
            ))}
          </div>
        )}

        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <p className="text-xs text-muted-foreground">
            {isTemp ? 'Sending...' : formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </p>
          
          {/* Read Receipt Indicators (only show for own messages) */}
          {isOwn && !isTemp && (
            <div className="flex items-center gap-0.5">
              {message.status === 'sent' && (
                <Check className="h-3 w-3 text-muted-foreground" />
              )}
              {message.status === 'delivered' && (
                <>
                  <Check className="h-3 w-3 text-muted-foreground" />
                  <Check className="h-3 w-3 text-muted-foreground -ml-2" />
                </>
              )}
              {message.status === 'seen' && (
                <>
                  <Check className="h-3 w-3 text-blue-500" />
                  <Check className="h-3 w-3 text-blue-500 -ml-2" />
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
