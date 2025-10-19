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
      className={`w-full flex items-start gap-2 py-1 ${isOwn ? 'flex-row-reverse' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onTouchCancel={handleMouseUp}
      onTouchMove={handleTouchMove}
    >
      {/* Avatar - only for incoming messages */}
      {!isOwn && showAvatar && (
        <img
          src={message.sender_profile?.avatar_url || '/placeholder.svg'}
          alt={message.sender_profile?.display_name || 'User'}
          className="w-8 h-8 rounded-full shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onAvatarClick}
        />
      )}

      {/* Bubble container - holds reaction bar, bubble, reactions, and metadata */}
      <div className="relative max-w-[75%]">
        {/* Reaction Bar (absolutely positioned above bubble) */}
        {showReactionBar && (
          <div className={`absolute -top-12 ${isOwn ? 'right-0' : 'left-0'} z-10`}>
            <ReactionBar onReact={handleReact} className="shadow-xl" />
          </div>
        )}

        {/* The actual message bubble */}
        <div
          className={`rounded-2xl px-3 py-2 break-words transition-all ${
            isOwn ? 'bg-[#11c4e9] text-white' : 'bg-gray-200 text-gray-900'
          } ${isTemp ? 'opacity-70' : ''} ${isLongPressing ? 'scale-95 opacity-80' : ''}`}
          onDoubleClick={() => setShowReactionBar(!showReactionBar)}
        >
          {/* Image attachment */}
          {message.image_url && (
            <div 
              className="cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onImageClick(message.image_url!)}
            >
              <img
                src={message.image_url}
                alt="Message attachment"
                className="rounded-xl max-w-full h-auto mb-2 max-h-48 object-cover hover:scale-[1.02] transition-transform"
              />
            </div>
          )}
          
          {/* Text content */}
          <p className="text-sm break-words overflow-wrap-anywhere hyphens-auto">
            {message.content}
          </p>
        </div>

        {/* Reaction pills */}
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

        {/* Timestamp + Read Receipts */}
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <p className="text-xs text-muted-foreground">
            {isTemp ? 'Sending...' : formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </p>
          
          {/* Read Receipt Indicators (only for own messages) */}
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

      {/* Ghost spacer for own messages to maintain alignment */}
      {isOwn && <div className="w-8 shrink-0" />}
    </div>
  );
};
