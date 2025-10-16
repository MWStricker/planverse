import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewMessagesPillProps {
  count: number;
  onClick: () => void;
}

export const NewMessagesPill = ({ count, onClick }: NewMessagesPillProps) => {
  if (count === 0) return null;

  return (
    <Button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2"
      size="sm"
      variant="default"
    >
      <ChevronDown className="h-4 w-4" />
      {count} new {count === 1 ? 'message' : 'messages'}
    </Button>
  );
};
