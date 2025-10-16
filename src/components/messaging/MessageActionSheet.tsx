import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, CornerUpLeft, Flag, XCircle } from 'lucide-react';

interface MessageActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
  };
  currentUserId: string;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onUnsend?: () => void;
  onReport?: () => void;
}

export const MessageActionSheet = ({
  open,
  onOpenChange,
  message,
  currentUserId,
  onReply,
  onCopy,
  onDelete,
  onUnsend,
  onReport,
}: MessageActionSheetProps) => {
  const isOwnMessage = message.sender_id === currentUserId;
  const messageAge = Date.now() - new Date(message.created_at).getTime();
  const canUnsend = isOwnMessage && messageAge < 3600000; // 1 hour

  const handleAction = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Message actions</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={() => handleAction(onReply)}
          >
            <CornerUpLeft className="h-4 w-4" />
            Reply
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={() => handleAction(onCopy)}
          >
            <Copy className="h-4 w-4" />
            Copy text
          </Button>

          {isOwnMessage && (
            <>
              {canUnsend && onUnsend && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                  onClick={() => handleAction(onUnsend)}
                >
                  <XCircle className="h-4 w-4" />
                  Unsend
                </Button>
              )}
              
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                onClick={() => handleAction(onDelete)}
              >
                <Trash2 className="h-4 w-4" />
                Delete for me
              </Button>
            </>
          )}

          {!isOwnMessage && onReport && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
              onClick={() => handleAction(onReport)}
            >
              <Flag className="h-4 w-4" />
              Report
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
