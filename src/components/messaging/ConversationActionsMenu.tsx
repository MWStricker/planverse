import { MoreVertical, Pin, PinOff, BellOff, Bell, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ConversationActionsMenuProps {
  conversationId: string;
  isPinned: boolean;
  isMuted: boolean;
  hasUnread: boolean;
  onPin: (id: string, currentStatus: boolean) => void;
  onMute: (id: string, currentStatus: boolean) => void;
  onMarkUnread: (id: string) => void;
}

export const ConversationActionsMenu: React.FC<ConversationActionsMenuProps> = ({
  conversationId,
  isPinned,
  isMuted,
  hasUnread,
  onPin,
  onMute,
  onMarkUnread,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onPin(conversationId, isPinned);
          }}
        >
          {isPinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              Unpin conversation
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              Pin conversation
            </>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onMute(conversationId, isMuted);
          }}
        >
          {isMuted ? (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Unmute conversation
            </>
          ) : (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              Mute conversation
            </>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onMarkUnread(conversationId);
          }}
          disabled={hasUnread}
        >
          <CircleDot className="mr-2 h-4 w-4" />
          Mark as unread
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
