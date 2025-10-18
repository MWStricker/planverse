import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin, BellOff } from 'lucide-react';
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
  other_user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface SortableConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (conversation: Conversation) => void;
  onPin: (id: string, currentStatus: boolean) => void;
  onMute: (id: string, currentStatus: boolean) => void;
  onMarkUnread: (id: string) => void;
}

export const SortableConversationItem: React.FC<SortableConversationItemProps> = ({
  conversation,
  isSelected,
  onSelect,
  onPin,
  onMute,
  onMarkUnread,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: conversation.id,
  });

  const { getUserStatus } = useRealtime();
  const userStatus = conversation.other_user?.id 
    ? getUserStatus(conversation.other_user.id) 
    : 'offline';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative p-2 border-b transition-colors ${
        isSelected ? 'bg-muted' : 'hover:bg-muted/50'
      } ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
    >
      {/* Drag handle - positioned absolutely, overlays on hover */}
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab hover:text-primary transition-colors opacity-0 group-hover:opacity-100 z-10"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
      {/* Conversation content */}
      <div 
        className="flex items-center gap-2 w-full cursor-pointer pl-7"
        onClick={() => onSelect(conversation)}
      >
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversation.other_user?.avatar_url} />
            <AvatarFallback>
              {conversation.other_user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          {/* Unread indicator - positioned outside avatar */}
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
        </div>
        
        {/* Actions menu - now inside flex container */}
        <ConversationActionsMenu
          conversationId={conversation.id}
          isPinned={conversation.is_pinned || false}
          isMuted={conversation.is_muted || false}
          hasUnread={(conversation.unread_count || 0) > 0}
          onPin={onPin}
          onMute={onMute}
          onMarkUnread={onMarkUnread}
        />
      </div>
    </div>
  );
};
