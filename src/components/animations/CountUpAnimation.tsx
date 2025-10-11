import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CountUpAnimationProps {
  end: number;
  duration?: number;
  className?: string;
  suffix?: string;
}

export const CountUpAnimation = ({ end, duration = 800, className, suffix = '' }: CountUpAnimationProps) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>();

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(easeOutQuart * end);

      countRef.current = currentCount;
      setCount(currentCount);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [end, duration, prefersReducedMotion]);

  return (
    <span className={cn("tabular-nums", className)}>
      {count}{suffix}
    </span>
  );
};
