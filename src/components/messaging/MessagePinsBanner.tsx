import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pin, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PinnedMessage {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
}

interface MessagePinsBannerProps {
  pinnedMessages: PinnedMessage[];
  onJumpToMessage: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  currentUserId: string;
  conversationCreatorId: string;
}

export const MessagePinsBanner = ({
  pinnedMessages,
  onJumpToMessage,
  onUnpin,
  currentUserId,
  conversationCreatorId
}: MessagePinsBannerProps) => {
  if (pinnedMessages.length === 0) return null;

  const canUnpin = currentUserId === conversationCreatorId;

  return (
    <Card className="mb-4 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {pinnedMessages.length} Pinned Message{pinnedMessages.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      <ScrollArea className="max-h-[200px]">
        <div className="space-y-2">
          {pinnedMessages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              onClick={() => onJumpToMessage(msg.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {msg.sender_name}
                </p>
                <p className="text-sm truncate">{msg.content}</p>
              </div>
              {canUnpin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpin(msg.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
