import { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Trash2, Pin, BellOff } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { UserStatusIndicator } from '@/components/UserStatusIndicator';
import { useRealtime } from '@/hooks/useRealtime';

interface Conversation {
  id: string;
  last_message_at: string;
  is_pinned?: boolean;
  is_muted?: boolean;
  unread_count?: number;
  last_message?: {
    id: string;
    content: string | null;
    image_url: string | null;
    sender_id: string;
    created_at: string;
  };
  other_user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface SwipeableConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (conversation: Conversation) => void;
  onPin: (id: string, currentStatus: boolean) => void;
  onMute: (id: string, currentStatus: boolean) => void;
  onMarkUnread: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const SwipeableConversationItem: React.FC<SwipeableConversationItemProps> = ({
  conversation,
  isSelected,
  onSelect,
  onPin,
  onMute,
  onMarkUnread,
  onDismiss,
}) => {
  const [dragX, setDragX] = useState(0);
  const { getUserStatus } = useRealtime();
  const userStatus = conversation.other_user?.id 
    ? getUserStatus(conversation.other_user.id) 
    : 'offline';

  const SWIPE_THRESHOLD = 120;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      // Trigger dismiss
      onDismiss(conversation.id);
    } else {
      // Reset position
      setDragX(0);
    }
  };

  const showDeleteButton = Math.abs(dragX) > 40;

  return (
    <div className="relative overflow-hidden">
      {/* Delete background */}
      <div className="absolute inset-0 bg-destructive flex items-center justify-end px-6">
        <Trash2 className="h-5 w-5 text-destructive-foreground" />
      </div>

      {/* Swipeable conversation */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.1}
        onDrag={(_event, info) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className={`relative bg-background p-2 border-b transition-colors ${
          isSelected ? 'bg-muted' : 'hover:bg-muted/50'
        }`}
      >
        {/* Conversation content */}
        <div 
          className="flex items-center gap-2 w-full cursor-pointer"
          onClick={() => !showDeleteButton && onSelect(conversation)}
        >
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={conversation.other_user?.avatar_url} />
              <AvatarFallback>
                {conversation.other_user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            {/* Unread indicator */}
            {conversation.unread_count != null && conversation.unread_count > 0 && (
              <div className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive rounded-full flex items-center justify-center text-[9px] text-white font-bold border-2 border-background">
                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm text-foreground truncate">
                {conversation.other_user?.display_name || 'Unknown User'}
              </h4>
              
              {/* Status indicator */}
              <UserStatusIndicator 
                status={userStatus}
                isCurrentUser={false}
                size="sm"
                compact
              />
              
              {/* Visual badges for pinned and muted */}
              <div className="flex items-center gap-1">
                {conversation.is_pinned && (
                  <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[9px]">
                    <Pin className="h-3 w-3" />
                  </Badge>
                )}
                {conversation.is_muted && (
                  <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[9px]">
                    <BellOff className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Last message preview */}
            {conversation.last_message && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {conversation.last_message.sender_id === conversation.other_user?.id
                  ? conversation.last_message.content || (conversation.last_message.image_url ? '📷 Photo' : '')
                  : `You: ${conversation.last_message.content || (conversation.last_message.image_url ? '📷 Photo' : '')}`
                }
              </p>
            )}
          </div>
          
          {/* Actions menu */}
          {!showDeleteButton && (
            <ConversationActionsMenu
              conversationId={conversation.id}
              isPinned={conversation.is_pinned || false}
              isMuted={conversation.is_muted || false}
              hasUnread={(conversation.unread_count || 0) > 0}
              onPin={onPin}
              onMute={onMute}
              onMarkUnread={onMarkUnread}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};
