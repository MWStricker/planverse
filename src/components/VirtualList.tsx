import React, { useRef, useState, useCallback, useEffect, memo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

/**
 * Virtual list component for rendering large lists efficiently
 * Only renders visible items + overscan for 60fps performance
 */
export const VirtualList = memo(<T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
}: VirtualListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate visible range
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
  
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(items.length, visibleEnd + overscan);
  
  const visibleItems = items.slice(start, end);
  const offsetY = start * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  // Throttled scroll handler for 60fps
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    requestAnimationFrame(() => {
      setScrollTop(e.currentTarget.scrollTop);
    });
  }, []);
  
  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            willChange: 'transform',
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={start + index}
              style={{
                height: itemHeight,
                transform: 'translateZ(0)',
              }}
            >
              {renderItem(item, start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}) as <T>(props: VirtualListProps<T>) => JSX.Element;
