import { memo } from 'react';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  color?: string;
}

export const CircularProgress = memo(({ 
  value, 
  max, 
  size = 48, 
  strokeWidth = 4, 
  className,
  children,
  color = "hsl(var(--primary))"
}: CircularProgressProps) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.2}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={prefersReducedMotion ? '' : 'transition-all duration-500 ease-out'}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
});

CircularProgress.displayName = 'CircularProgress';
