/**
 * Route prefetching utilities
 * Preload data for routes before navigation
 */

type PrefetchFunction = () => Promise<any>;

const prefetchCache = new Map<string, Promise<any>>();

/**
 * Prefetch data for a route
 */
export const prefetchRoute = async (
  routeName: string,
  fetchFn: PrefetchFunction
): Promise<void> => {
  // Check if already prefetching or cached
  if (prefetchCache.has(routeName)) {
    return prefetchCache.get(routeName);
  }
  
  // Start prefetching
  const promise = fetchFn()
    .then((data) => {
      // Store in sessionStorage for persistence
      try {
        sessionStorage.setItem(
          `prefetch_${routeName}`,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.warn('Failed to cache prefetch data:', e);
      }
      return data;
    })
    .catch((error) => {
      console.error(`Failed to prefetch ${routeName}:`, error);
      prefetchCache.delete(routeName);
      throw error;
    });
  
  prefetchCache.set(routeName, promise);
  return promise;
};

/**
 * Get prefetched data
 */
export const getPrefetchedData = <T = any>(
  routeName: string,
  maxAge: number = 5 * 60 * 1000 // 5 minutes default
): T | null => {
  try {
    const cached = sessionStorage.getItem(`prefetch_${routeName}`);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Check if data is still fresh
    if (Date.now() - timestamp > maxAge) {
      sessionStorage.removeItem(`prefetch_${routeName}`);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
};

/**
 * Clear prefetch cache for a route
 */
export const clearPrefetchCache = (routeName?: string): void => {
  if (routeName) {
    prefetchCache.delete(routeName);
    sessionStorage.removeItem(`prefetch_${routeName}`);
  } else {
    // Clear all
    prefetchCache.clear();
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('prefetch_')) {
        sessionStorage.removeItem(key);
      }
    });
  }
};

/**
 * Hook to prefetch on hover/focus
 */
export const usePrefetchOnHover = (
  routeName: string,
  fetchFn: PrefetchFunction
) => {
  let timeout: NodeJS.Timeout;
  
  const handleMouseEnter = () => {
    // Delay prefetch slightly to avoid prefetching on accidental hovers
    timeout = setTimeout(() => {
      prefetchRoute(routeName, fetchFn);
    }, 100);
  };
  
  const handleMouseLeave = () => {
    clearTimeout(timeout);
  };
  
  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleMouseEnter,
  };
};
