import { Button } from '@/components/ui/button';

interface ReactionPillProps {
  emoji: string;
  count: number;
  userReacted: boolean;
  onClick: () => void;
}

export const ReactionPill = ({ emoji, count, userReacted, onClick }: ReactionPillProps) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-6 px-2 py-0 gap-1 rounded-full text-xs transition-all ${
        userReacted 
          ? 'bg-primary/20 border border-primary hover:bg-primary/30' 
          : 'bg-secondary/50 border border-border hover:bg-secondary'
      }`}
      onClick={onClick}
      aria-label={`${count} reaction${count !== 1 ? 's' : ''} with ${emoji}`}
    >
      <span className="text-sm">{emoji}</span>
      <span className="font-medium">{count}</span>
    </Button>
  );
};
