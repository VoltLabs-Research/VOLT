import { useEffect } from 'react';
import useRasterStore from '@/stores/raster';

const CACHE_CLEANUP_INTERVAL = 300000; // 5 minutes
const CACHE_MAX_AGE = 600000; // 10 minutes

export const useCacheCleanup = () => {
  const { frameCache, clearFrameCache } = useRasterStore();

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cacheKeys = Object.keys(frameCache);
      let hasExpiredEntries = false;

      for (const key of cacheKeys) {
        const entry = frameCache[key];
        if (entry && now - entry.timestamp > CACHE_MAX_AGE) {
          hasExpiredEntries = true;
          break;
        }
      }

      if (hasExpiredEntries) {
        const validEntries: any = {};
        for (const key of cacheKeys) {
          const entry = frameCache[key];
          if (entry && now - entry.timestamp <= CACHE_MAX_AGE) {
            validEntries[key] = entry;
          }
        }
        
        useRasterStore.setState({ frameCache: validEntries });
      }
    }, CACHE_CLEANUP_INTERVAL);

    return () => clearInterval(cleanupInterval);
  }, [frameCache]);

  // Clear cache when component unmounts
  useEffect(() => {
    return () => {
      clearFrameCache();
    };
  }, [clearFrameCache]);
};

export default useCacheCleanup;
