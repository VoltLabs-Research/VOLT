import { useEffect, useState, useMemo } from 'react';
import useRasterStore from '@/stores/raster';
import type { Scene } from '@/types/raster';

interface UseRasterFrameResult {
  scene: Scene | null;
  isLoading: boolean;
  error: string | null;
}

export const useRasterFrame = (
  trajectoryId: string | undefined,
  timestep: number | undefined,
  analysisId: string | undefined,
  model: string | undefined
): UseRasterFrameResult => {
  const { getRasterFrame, getFrameCacheKey, frameCache, loadingFrames, unavailableFrames } = useRasterStore();
  const [error, setError] = useState<string | null>(null);

  const cacheKey = useMemo(() => 
    trajectoryId && (timestep !== undefined && timestep !== null) && analysisId && model 
      ? getFrameCacheKey(timestep, analysisId, model)
      : null,
    [trajectoryId, timestep, analysisId, model, getFrameCacheKey]
  );

  const cachedFrame = cacheKey ? frameCache[cacheKey] : null;
  const isLoading = cacheKey ? loadingFrames.has(cacheKey) : false;
  const isUnavailable = cacheKey ? unavailableFrames.has(cacheKey) : false;

  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    if (!trajectoryId || (timestep === undefined || timestep === null) || !analysisId || !model || !cacheKey) {
      setScene(null);
      return;
    }

    // Si sabemos que no está disponible, no mostrar como cargando
    if (isUnavailable) {
      setScene({
        frame: timestep,
        model,
        analysisId,
        isLoading: false,
        isUnavailable: true
      });
      setError('Frame not available');
      return;
    }

    if (cachedFrame) {
      setScene({
        frame: timestep,
        model,
        analysisId,
        data: cachedFrame.data,
        isLoading: false
      });
      setError(null);
      return;
    }

    if (isLoading) {
      setScene({
        frame: timestep,
        model,
        analysisId,
        isLoading: true
      });
      return;
    }

    const loadFrame = async () => {
      try {
        setError(null);
        const data = await getRasterFrame(trajectoryId, timestep, analysisId, model);
        
        if (data) {
          setScene({
            frame: timestep,
            model,
            analysisId,
            data,
            isLoading: false
          });
        } else {
          setScene({
            frame: timestep,
            model,
            analysisId,
            isLoading: false,
            isUnavailable: true
          });
          setError('Failed to load frame');
        }
      } catch (err) {
        console.error('Error loading frame:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setScene({
          frame: timestep,
          model,
          analysisId,
          isLoading: false,
          isUnavailable: true
        });
      }
    };

    loadFrame();
  }, [trajectoryId, timestep, analysisId, model, cacheKey, cachedFrame, isLoading, isUnavailable, getRasterFrame, getFrameCacheKey]);

  return {
    scene,
    isLoading,
    error
  };
};

export default useRasterFrame;
