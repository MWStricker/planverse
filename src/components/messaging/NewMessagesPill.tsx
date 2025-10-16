import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface NewMessagesPillProps {
  count: number;
  onClick: () => void;
}

export const NewMessagesPill = ({ count, onClick }: NewMessagesPillProps) => {
  if (count === 0) return null;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-2">
      <Button
        variant="secondary"
        size="sm"
        className="shadow-lg rounded-full px-4 py-2 flex items-center gap-2"
        onClick={onClick}
      >
        <ChevronDown className="h-4 w-4" />
        <span className="font-medium">{count} new message{count > 1 ? 's' : ''}</span>
      </Button>
    </div>
  );
};
