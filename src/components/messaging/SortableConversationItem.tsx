import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin, BellOff } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ConversationActionsMenu } from './ConversationActionsMenu';

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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-3 border-b transition-colors ${
        conversation.is_pinned ? 'bg-primary/5' : ''
      } ${
        isSelected ? 'bg-muted' : 'hover:bg-muted/50'
      } ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle - visible on hover */}
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        
        {/* Conversation content */}
        <div 
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => onSelect(conversation)}
        >
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={conversation.other_user?.avatar_url} />
              <AvatarFallback>
                {conversation.other_user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            {/* Unread indicator - positioned outside avatar */}
            {conversation.unread_count != null && conversation.unread_count > 0 && (
              <div className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full flex items-center justify-center text-[10px] text-white font-bold border-2 border-background">
                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-foreground truncate">
                {conversation.other_user?.display_name || 'Unknown User'}
              </h4>
              
              {/* Visual badges for pinned and muted */}
              <div className="flex items-center gap-1">
                {conversation.is_pinned && (
                  <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px]">
                    <Pin className="h-3 w-3" />
                  </Badge>
                )}
                {conversation.is_muted && (
                  <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px]">
                    <BellOff className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        {/* Actions menu */}
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
