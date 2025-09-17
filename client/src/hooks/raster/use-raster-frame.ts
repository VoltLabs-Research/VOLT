import { useState, useEffect, useRef } from 'react';
import useRasterStore from '@/stores/raster';

export interface UseRasterFrameProps {
  trajectoryId: string;
  timestep: number;
  analysisId: string;
  model: string;
  priority?: 'high' | 'low';
  showInScene?: boolean;
}

interface InternalRasterFrameResult {
  frameData: string | null;
  isLoading: boolean;
  isAvailable: boolean;
  error: Error | null;
}

export interface UseRasterFrameResult {
  scene: {
    frame: number;
    model: string;
    analysisId: string;
    data?: string;
    isUnavailable?: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;
}

// Internal implementation that doesn't use useThree
const useRasterFrameInternal = ({
  trajectoryId,
  timestep,
  analysisId,
  model,
  priority = 'high',
  showInScene = true,
}: UseRasterFrameProps): UseRasterFrameResult => {
  const { getRasterFrame, getFrameCacheKey, loadingFrames, cachedFrameExists } = useRasterStore();
  const [frameData, setFrameData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const loadPromiseRef = useRef<Promise<string | null> | null>(null);
  
  // Flag to determine if showInScene functionality should be attempted
  // We don't actually need to use the Three.js scene directly in this hook
  const isInsideCanvas = showInScene && typeof window !== 'undefined';

  // Create a unique ID for logs
  const cacheKey = getFrameCacheKey(timestep, analysisId, model);
  const hookId = `${trajectoryId.substring(0, 4)}-${model}-${priority}`;
  
  // Store attempted frames in localStorage to avoid repeated failed requests
  const unavailableFramesKey = `${trajectoryId}-unavailable-frames`;

  useEffect(() => {
    console.log(`[use-raster-frame:${hookId}] Initial params:`, {
      trajectoryId,
      timestep,
      analysisId,
      model,
      priority,
      cacheKey,
      showInScene
    });

    // Clean up state when parameters change
    setFrameData(null);
    setError(null);
    setIsLoading(false);
    setIsAvailable(true);

    // Variable to prevent updating state if component unmounts
    let mounted = true;

    // Check if frame is already loading or cached
    const frameAlreadyLoading = loadingFrames.has(cacheKey);
    const frameExists = cachedFrameExists(cacheKey);
    
    // Check if we've previously marked this frame as unavailable
    const unavailableFrames = JSON.parse(localStorage.getItem(unavailableFramesKey) || '{}');
    const isFrameKnownUnavailable = unavailableFrames[cacheKey];
    
    // If we know it's unavailable, don't try loading it
    if (isFrameKnownUnavailable) {
      console.log(`[use-raster-frame:${hookId}] Frame ${cacheKey} known to be unavailable, skipping fetch`);
      setIsAvailable(false);
      setError(new Error(`Frame ${timestep} with model ${model} not available`));
      return;
    }
    
    // If it's cached, we consider it available
    if (frameExists) {
      setIsAvailable(true);
    }

    const loadFrame = async () => {
      // If already loading, don't start another load
      if (frameAlreadyLoading) {
        console.log(`[use-raster-frame:${hookId}] Frame ${cacheKey} already loading, waiting...`);
        return;
      }

      // If we already have data for this frame, don't load it again
      if (frameData) {
        console.log(`[use-raster-frame:${hookId}] Frame ${timestep} already loaded with data, skipping fetch`);
        return;
      }

      // If low priority, delay loading a bit
      if (priority === 'low') {
        console.log(`[use-raster-frame:${hookId}] Low priority frame ${timestep}, delaying load`);
        
        // Use requestIdleCallback if available, or setTimeout as fallback
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            if (mounted) fetchRasterFrame();
          });
        } else {
          setTimeout(() => {
            if (mounted) fetchRasterFrame();
          }, 200);
        }
        return;
      }

      fetchRasterFrame();
    };

    const fetchRasterFrame = async () => {
      if (!mounted) return;
      
      // If there's already a promise in progress for this frame, reuse it
      if (loadPromiseRef.current) return loadPromiseRef.current;
      
      try {
        setIsLoading(true);
        
        console.log(`[use-raster-frame:${hookId}] Calling getRasterFrame with:`, {
          trajectoryId,
          timestep,
          analysisId,
          model
        });
        
        // Create and save the promise
        loadPromiseRef.current = getRasterFrame(trajectoryId, timestep, analysisId, model);
        
        // Wait for the result
        const data = await loadPromiseRef.current;
        
        if (!mounted) return;
        
        if (!data) {
          console.log(`[use-raster-frame:${hookId}] No data returned for frame ${timestep}, marking as unavailable`);
          setIsAvailable(false);
          setError(new Error(`Frame ${timestep} not available`));
          
          // Store this frame as unavailable to avoid future requests
          const unavailableFrames = JSON.parse(localStorage.getItem(unavailableFramesKey) || '{}');
          unavailableFrames[cacheKey] = true;
          localStorage.setItem(unavailableFramesKey, JSON.stringify(unavailableFrames));
        } else {
          console.log(`[use-raster-frame:${hookId}] Frame data loaded for analysis ${analysisId}, model ${model}, timestep ${timestep}`);
          setFrameData(data);
        }
      } catch (err) {
        if (!mounted) return;
        console.error(`[use-raster-frame:${hookId}] Error loading frame:`, err);
        setError(err instanceof Error ? err : new Error('Unknown error loading frame'));
        setIsAvailable(false);
        
        // Store this frame as unavailable to avoid future requests
        const unavailableFrames = JSON.parse(localStorage.getItem(unavailableFramesKey) || '{}');
        unavailableFrames[cacheKey] = true;
        localStorage.setItem(unavailableFramesKey, JSON.stringify(unavailableFrames));
      } finally {
        if (mounted) {
          setIsLoading(false);
          loadPromiseRef.current = null; // Clean up the promise reference
        }
      }
    };

    loadFrame();

    return () => {
      mounted = false;
    };
  }, [trajectoryId, analysisId, model, timestep, getRasterFrame, isInsideCanvas, cacheKey, priority, hookId, unavailableFramesKey, cachedFrameExists, loadingFrames]);

  return {
    frameData,
    isLoading,
    isAvailable,
    error,
  };
};

// Keep the internal implementation for reference but don't export it
// Not currently used by default export, but kept for documentation purposes

// Default export with the interface expected by HeadlessRasterizerView
export default function useRasterFrameWrapper(
  trajectoryId?: string,
  timestep?: number,
  analysisId?: string,
  model?: string
): UseRasterFrameResult {
  // Initialize with defaults
  const [scene, setScene] = useState<UseRasterFrameResult['scene']>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store attempted frames in localStorage to avoid repeated failed requests
  const unavailableFramesKey = trajectoryId ? `${trajectoryId}-unavailable-frames` : null;

  // Only call the internal hook if all required params are present
  useEffect(() => {
    if (!trajectoryId || !model || timestep === undefined || !analysisId) {
      setScene(null);
      setError("Missing required parameters");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // This is a side effect to simulate the frame loading
    // without using useThree outside of a Canvas
    const fetchFrame = async () => {
      // Create a unique cache key for this frame
      const cacheKey = `${timestep}-${analysisId}-${model}`;
      
      // Check if we've previously marked this frame as unavailable
      if (unavailableFramesKey) {
        try {
          const unavailableFrames = JSON.parse(localStorage.getItem(unavailableFramesKey) || '{}');
          const isFrameKnownUnavailable = unavailableFrames[cacheKey];
          
          if (isFrameKnownUnavailable) {
            console.log(`[use-raster-frame] Frame ${cacheKey} known to be unavailable, skipping fetch`);
            setScene({
              frame: timestep,
              model,
              analysisId,
              isUnavailable: true
            });
            setError(`Frame ${timestep} with model ${model} not available`);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          // If localStorage access fails, continue with the request
          console.warn("Could not access localStorage for frame cache");
        }
      }
    
      try {
        const { getRasterFrame } = useRasterStore.getState();
        const frameData = await getRasterFrame(trajectoryId, timestep, analysisId, model);
        
        if (frameData) {
          setScene({
            frame: timestep,
            model,
            analysisId,
            data: frameData,
            isUnavailable: false
          });
          setError(null);
        } else {
          setScene({
            frame: timestep,
            model,
            analysisId,
            isUnavailable: true
          });
          setError(`Frame ${timestep} not available`);
          
          // Store this frame as unavailable to avoid future requests
          if (unavailableFramesKey) {
            try {
              const unavailableFrames = JSON.parse(localStorage.getItem(unavailableFramesKey) || '{}');
              unavailableFrames[cacheKey] = true;
              localStorage.setItem(unavailableFramesKey, JSON.stringify(unavailableFrames));
            } catch (e) {
              console.warn("Could not store unavailable frame in localStorage");
            }
          }
        }
      } catch (err) {
        setScene({
          frame: timestep,
          model,
          analysisId,
          isUnavailable: true
        });
        setError(err instanceof Error ? err.message : "Unknown error loading frame");
        
        // Store this frame as unavailable to avoid future requests
        if (unavailableFramesKey) {
          try {
            const unavailableFrames = JSON.parse(localStorage.getItem(unavailableFramesKey) || '{}');
            unavailableFrames[cacheKey] = true;
            localStorage.setItem(unavailableFramesKey, JSON.stringify(unavailableFrames));
          } catch (e) {
            console.warn("Could not store unavailable frame in localStorage");
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchFrame();
  }, [trajectoryId, timestep, analysisId, model, unavailableFramesKey]);

  return {
    scene,
    isLoading,
    error
  };
};
