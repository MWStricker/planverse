import { cn } from '@/lib/utils';

interface DailyProgressProps {
  completed: number;
  total: number;
  className?: string;
}

export const DailyProgress = ({ completed, total, className }: DailyProgressProps) => {
  if (total === 0) return null;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Color coding: green > 50%, yellow 25-50%, red < 25%
  const getColor = () => {
    if (percentage >= 50) return 'bg-green-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Today:</span>
        <span className="text-sm font-medium">
          {completed}/{total}
        </span>
      </div>
      <div className="relative w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-300", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-medium">{percentage}%</span>
    </div>
  );
};
