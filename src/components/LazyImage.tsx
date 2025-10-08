import React, { useState, useRef, useEffect, memo } from 'react';
import { useIntersectionObserver } from '@/lib/performance';
import { Skeleton } from './ui/skeleton';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
}

/**
 * Lazy-loaded image component with skeleton placeholder
 * Only loads when visible in viewport for performance
 */
export const LazyImage = memo(({
  src,
  alt,
  className = '',
  skeletonClassName = '',
  ...props
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { hasIntersected } = useIntersectionObserver(imgRef);
  
  useEffect(() => {
    if (!hasIntersected || !src) return;
    
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setIsLoaded(true);
    };
    
    img.onerror = () => {
      setHasError(true);
    };
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [hasIntersected, src]);
  
  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <span className="text-sm text-muted-foreground">Failed to load image</span>
      </div>
    );
  }
  
  return (
    <div ref={imgRef} className="relative">
      {!isLoaded && (
        <Skeleton className={`absolute inset-0 ${skeletonClassName}`} />
      )}
      {hasIntersected && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          style={{
            transform: 'translateZ(0)',
            willChange: 'opacity',
          }}
          onLoad={() => setIsLoaded(true)}
          {...props}
        />
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';
