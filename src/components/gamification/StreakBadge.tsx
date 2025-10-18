import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export const StreakBadge = ({ streak, className }: StreakBadgeProps) => {
  if (streak === 0) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
        className
      )}
    >
      <Flame className="h-4 w-4" />
      <span className="text-sm font-semibold">{streak} day{streak !== 1 ? 's' : ''}</span>
    </div>
  );
};
