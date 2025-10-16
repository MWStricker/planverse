import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReplyPreviewProps {
  message: {
    content: string;
    sender_profile?: {
      display_name: string;
    };
  };
  onDismiss: () => void;
}

export const ReplyPreview = ({ message, onDismiss }: ReplyPreviewProps) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 border-l-4 border-primary">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-primary">
          Replying to {message.sender_profile?.display_name || 'Unknown'}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {message.content}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 flex-shrink-0"
        onClick={onDismiss}
        aria-label="Cancel reply"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
