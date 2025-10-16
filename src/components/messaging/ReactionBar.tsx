import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ReactionBarProps {
  onReact: (emoji: string) => void;
  className?: string;
}

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export const ReactionBar = ({ onReact, className }: ReactionBarProps) => {
  const [showMore, setShowMore] = useState(false);

  const handleReact = (emoji: string) => {
    onReact(emoji);
    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <div className={`flex items-center gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-lg ${className}`}>
      {DEFAULT_REACTIONS.map((emoji) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:scale-125 transition-transform"
          onClick={() => handleReact(emoji)}
          aria-label={`React with ${emoji}`}
        >
          <span className="text-lg">{emoji}</span>
        </Button>
      ))}
      
      <Popover open={showMore} onOpenChange={setShowMore}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:scale-125 transition-transform"
            aria-label="More reactions"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="end">
          <div className="grid grid-cols-6 gap-1">
            {['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '🙃', '😉',
              '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
              '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕',
              '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡'].map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 hover:scale-125 transition-transform"
                onClick={() => {
                  handleReact(emoji);
                  setShowMore(false);
                }}
              >
                <span className="text-xl">{emoji}</span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
