// Simple in-memory cache with TTL support
class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>();
  
  set(key: string, data: any, ttlMs: number) {
    this.cache.set(key, { data, expires: Date.now() + ttlMs });
  }
  
  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
  
  clear(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    // Clear entries matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  invalidate(key: string) {
    this.cache.delete(key);
  }
}

export const cache = new SimpleCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  PROFILE: 5 * 60 * 1000,        // 5 minutes
  UNIVERSITIES: 60 * 60 * 1000,  // 1 hour
  COURSE_COLORS: 60 * 60 * 1000, // 1 hour
  POSTS: 30 * 1000,              // 30 seconds
} as const;
