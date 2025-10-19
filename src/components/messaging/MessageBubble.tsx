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
  return (
    <div
      className={`w-full min-w-0 flex items-end gap-2 py-1 ${isOwn ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar - only for incoming messages */}
      {!isOwn && showAvatar && (
        <img
          src={message.sender_profile?.avatar_url || '/placeholder.svg'}
          alt={message.sender_profile?.display_name || 'User'}
          className="w-8 h-8 rounded-full shrink-0"
          onClick={onAvatarClick}
        />
      )}

      {/* Bubble - content-sized, not lane-sized */}
      <div
        className={`w-fit max-w-[72%] grow-0 shrink-0 rounded-2xl px-3 py-2
                    break-words whitespace-pre-wrap
                    ${isOwn ? 'bg-[#11c4e9] text-white' : 'bg-gray-200 text-gray-900'}`}
      >
        {message.image_url ? (
          <img
            src={message.image_url}
            alt=""
            className="rounded-xl max-w-full h-auto block"
          />
        ) : (
          message.content
        )}
      </div>

      {/* Spacer only on my side to mirror avatar width */}
      {isOwn && <div className="w-8 shrink-0" />}
    </div>
  );
};
