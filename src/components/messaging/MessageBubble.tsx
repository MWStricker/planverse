import { useState, useEffect } from 'react';
import { Message } from '@/hooks/useMessaging';
import { useReactions } from '@/hooks/useReactions';
import { ReactionBar } from './ReactionBar';
import { ReactionPill } from './ReactionPill';
import { formatDistanceToNow } from 'date-fns';
import { Check } from 'lucide-react';
import { hapticFeedback } from '@/lib/haptics';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isTemp: boolean;
  onImageClick: (url: string) => void;
  onLongPress: (message: Message) => void;
  onReactionClick: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  isPinned?: boolean;
  forceShowReactionBar?: boolean;
  onReactionBarClose?: () => void;
  showAvatar?: boolean;
  onAvatarClick?: () => void;
}

export const MessageBubble = ({
  message,
  isOwn,
  isTemp,
  onImageClick,
  onLongPress,
  onReactionClick,
  forceShowReactionBar = false,
  onReactionBarClose,
  showAvatar = false,
  onAvatarClick
}: MessageBubbleProps) => {
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const { reactions, addReaction } = useReactions(message.id);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    console.log('[MessageBubble] Long press started for message:', message.id);
    
    // Record touch/mouse position
    if ('touches' in e) {
      setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else {
      setTouchStartPos({ x: e.clientX, y: e.clientY });
    }
    
    setIsLongPressing(true);
    const timer = setTimeout(() => {
      console.log('[MessageBubble] Long press triggered for message:', message.id);
      
      // Trigger haptic feedback
      hapticFeedback('medium');
      
      onLongPress(message);
      setIsLongPressing(false);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    
    // Only cancel if moved more than 10 pixels (allows for finger wobble)
    if (deltaX > 10 || deltaY > 10) {
      console.log('[MessageBubble] Touch moved too far, canceling long press');
      handleMouseUp();
    }
  };

  const handleMouseUp = () => {
    console.log('[MessageBubble] Long press cancelled/ended');
    setIsLongPressing(false);
    setTouchStartPos(null);
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleReact = async (emoji: string) => {
    await addReaction(message.id, emoji);
    setShowReactionBar(false);
    onReactionBarClose?.();
  };

  // Listen for external trigger to show reaction bar
  useEffect(() => {
    if (forceShowReactionBar) {
      setShowReactionBar(true);
    }
  }, [forceShowReactionBar]);

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onTouchCancel={handleMouseUp}
      onTouchMove={handleTouchMove}
    >
      <div className={`flex items-end gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar for incoming messages */}
        {!isOwn && showAvatar && (
          <img
            src={message.sender_profile?.avatar_url || '/placeholder.svg'}
            alt={message.sender_profile?.display_name || 'User'}
            className="w-8 h-8 rounded-full shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onAvatarClick}
          />
        )}

        <div className={`relative ${isOwn ? 'order-2' : 'order-1'}`}>
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
          className={`rounded-lg px-3 py-2 flex flex-col w-fit break-words overflow-wrap-anywhere transition-all ${
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          } ${isTemp ? 'opacity-70' : ''} ${isLongPressing ? 'scale-95 opacity-80' : ''}`}
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
    </div>
  );
};
