import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendIndicatorProps {
  value: number;
  previousValue: number;
  label?: string;
  className?: string;
}

export const TrendIndicator = memo(({ value, previousValue, label, className }: TrendIndicatorProps) => {
  const difference = value - previousValue;
  const percentageChange = previousValue > 0 ? Math.abs((difference / previousValue) * 100) : 0;
  
  const isIncrease = difference > 0;
  const isDecrease = difference < 0;
  const isNeutral = difference === 0;

  if (isNeutral && previousValue === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 text-xs", className)}>
      {isIncrease && (
        <>
          <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
          <span className="text-green-600 dark:text-green-400 font-medium">
            +{percentageChange.toFixed(0)}%
          </span>
        </>
      )}
      {isDecrease && (
        <>
          <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
          <span className="text-red-600 dark:text-red-400 font-medium">
            {percentageChange.toFixed(0)}%
          </span>
        </>
      )}
      {isNeutral && (
        <>
          <Minus className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground font-medium">0%</span>
        </>
      )}
      {label && <span className="text-muted-foreground ml-1">{label}</span>}
    </div>
  );
});

TrendIndicator.displayName = 'TrendIndicator';
