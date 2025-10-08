import { useEffect, useRef } from 'react';

/**
 * Performance monitoring hook
 * Measures render time and logs warnings for slow renders
 */
export const usePerformanceMonitor = (
  componentName: string,
  threshold: number = 16 // 16ms = 60fps
) => {
  const renderStart = useRef<number>(0);
  const renderCount = useRef<number>(0);
  
  // Measure render start time
  renderStart.current = performance.now();
  renderCount.current += 1;
  
  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;
    
    if (renderTime > threshold) {
      console.warn(
        `[Performance] ${componentName} render #${renderCount.current} took ${renderTime.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }
    
    // Log every 100 renders for analytics
    if (renderCount.current % 100 === 0) {
      console.log(
        `[Performance] ${componentName} has rendered ${renderCount.current} times. Average last render: ${renderTime.toFixed(2)}ms`
      );
    }
  });
};

/**
 * Frame rate monitor
 * Tracks actual FPS and logs warnings
 */
export const useFrameRateMonitor = (enabled: boolean = false) => {
  useEffect(() => {
    if (!enabled) return;
    
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 60;
    
    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        if (fps < 50) {
          console.warn(`[Performance] Low FPS detected: ${fps}fps`);
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    const rafId = requestAnimationFrame(measureFPS);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);
};

/**
 * Network performance monitor
 * Tracks API call times
 */
export const useNetworkMonitor = () => {
  const logAPICall = (endpoint: string, duration: number) => {
    if (duration > 1000) {
      console.warn(
        `[Network] Slow API call to ${endpoint}: ${duration.toFixed(0)}ms`
      );
    }
  };
  
  const measureAPICall = async <T,>(
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      logAPICall(endpoint, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logAPICall(endpoint, duration);
      throw error;
    }
  };
  
  return { measureAPICall };
};
