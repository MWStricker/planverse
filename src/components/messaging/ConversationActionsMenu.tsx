import { MoreVertical, Pin, PinOff, BellOff, Bell, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeDropdown, NativeDropdownItem, NativeDropdownSeparator } from '@/components/ui/native-dropdown';

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
    <NativeDropdown
      trigger={<MoreVertical className="h-4 w-4 text-muted-foreground" />}
      label="Conversation actions"
      align="end"
      className="w-48"
      triggerClassName="shrink-0 h-8 w-8 border-0 bg-transparent hover:bg-muted/50"
    >
      <NativeDropdownItem
        onClick={() => {
          onPin(conversationId, isPinned);
        }}
      >
        {isPinned ? (
          <>
            <PinOff className="h-4 w-4" />
            Unpin conversation
          </>
        ) : (
          <>
            <Pin className="h-4 w-4" />
            Pin conversation
          </>
        )}
      </NativeDropdownItem>
      
      <NativeDropdownItem
        onClick={() => {
          onMute(conversationId, isMuted);
        }}
      >
        {isMuted ? (
          <>
            <Bell className="h-4 w-4" />
            Unmute conversation
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4" />
            Mute conversation
          </>
        )}
      </NativeDropdownItem>
      
      <NativeDropdownSeparator />
      
      <NativeDropdownItem
        onClick={() => {
          onMarkUnread(conversationId);
        }}
        disabled={hasUnread}
      >
        <CircleDot className="h-4 w-4" />
        Mark as unread
      </NativeDropdownItem>
    </NativeDropdown>
  );
};
