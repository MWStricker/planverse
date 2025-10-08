// Performance utilities for 60fps rendering and low input latency

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounce function for scroll/resize events
 * Prevents excessive re-renders and maintains 60fps
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for high-frequency events
 * Ensures callbacks run at most once per frame
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number = 16 // ~60fps
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Request Animation Frame wrapper for smooth animations
 */
export const useRAF = (callback: () => void, deps: any[] = []) => {
  const rafId = useRef<number>();
  
  useEffect(() => {
    const animate = () => {
      callback();
      rafId.current = requestAnimationFrame(animate);
    };
    
    rafId.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, deps);
};

/**
 * Batch DOM updates to prevent layout thrashing
 */
export const batchUpdates = (updates: (() => void)[]) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

/**
 * Measure render performance
 */
export const measureRender = (componentName: string, threshold: number = 16) => {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    if (renderTime > threshold) {
      console.warn(
        `[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render (threshold: ${threshold}ms)`
      );
    }
    
    return renderTime;
  };
};

/**
 * Hook for debounced scroll events
 */
export const useDebouncedScroll = (
  callback: (event: Event) => void,
  delay: number = 150
) => {
  const debouncedCallback = useRef(debounce(callback, delay));
  
  useEffect(() => {
    const handler = (e: Event) => debouncedCallback.current(e);
    window.addEventListener('scroll', handler, { passive: true });
    
    return () => window.removeEventListener('scroll', handler);
  }, []);
};

/**
 * Hook for debounced resize events
 */
export const useDebouncedResize = (
  callback: (event: Event) => void,
  delay: number = 150
) => {
  const debouncedCallback = useRef(debounce(callback, delay));
  
  useEffect(() => {
    const handler = (e: Event) => debouncedCallback.current(e);
    window.addEventListener('resize', handler, { passive: true });
    
    return () => window.removeEventListener('resize', handler);
  }, []);
};

/**
 * Intersection Observer hook for lazy loading
 */
export const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
        ...options,
      }
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [ref, hasIntersected]);
  
  return { isIntersecting, hasIntersected };
};

/**
 * Prefetch data for upcoming routes
 */
export const prefetchRoute = async (path: string, dataFetcher: () => Promise<any>) => {
  try {
    const data = await dataFetcher();
    sessionStorage.setItem(`prefetch_${path}`, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error(`Failed to prefetch ${path}:`, error);
  }
};

/**
 * Get prefetched data
 */
export const getPrefetchedData = (path: string) => {
  try {
    const data = sessionStorage.getItem(`prefetch_${path}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Virtual scroll hook for long lists
 */
export const useVirtualScroll = <T,>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
  
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(items.length, visibleEnd + overscan);
  
  const visibleItems = items.slice(start, end);
  const offsetY = start * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return {
    visibleItems,
    offsetY,
    totalHeight,
    handleScroll,
    start,
    end,
  };
};
