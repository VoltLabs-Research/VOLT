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
  const { getRasterFrame, getFrameCacheKey, loadingFrames } = useRasterStore();
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);

  const cacheKey = useMemo(() => 
    trajectoryId && (timestep !== undefined && timestep !== null) && analysisId && model 
      ? getFrameCacheKey(timestep, analysisId, model)
      : null,
    [trajectoryId, timestep, analysisId, model, getFrameCacheKey]
  );

  const isLoading = cacheKey ? loadingFrames.has(cacheKey) : false;

  // Reset state when parameters change
  useEffect(() => {
    // Si el timestep es -1, significa que aún no se ha seleccionado un frame
    if (timestep === -1) {
      console.log(`[use-raster-frame] Timestep is -1, showing empty state`);
      setScene(null);
      setError(null);
      return;
    }
    
    // No resetear completamente el estado al cambiar de frame, 
    // sólo marcar que está cargando pero mantener los datos anteriores visibles
    if (scene && timestep !== undefined && scene.frame !== timestep) {
      console.log(`[use-raster-frame] Frame changed from ${scene.frame} to ${timestep}, loading new data`);
      setScene({
        ...scene,
        frame: timestep,
        isLoading: true,
        isUnavailable: false,
      });
    } else if (!scene && timestep !== undefined && analysisId && model) {
      // Si no hay escena pero tenemos datos suficientes, crear una escena inicial en estado de carga
      console.log(`[use-raster-frame] Creating initial loading scene for timestep ${timestep}`);
      setScene({
        frame: timestep,
        model: model,
        analysisId: analysisId,
        data: undefined, 
        isLoading: true,
        isUnavailable: false
      });
    } else if (!scene) {
      // Si no hay escena ni datos suficientes, resetear completamente
      setScene(null);
      setError(null);
    }
  }, [trajectoryId, timestep, analysisId, model, scene]);

  useEffect(() => {
    if (!trajectoryId || timestep === undefined || !analysisId || !model) {
      return;
    }

    // Si el timestep es -1, significa que aún no se ha seleccionado un frame, no cargar nada
    if (timestep === -1) {
      console.log(`[use-raster-frame] Timestep is -1, not loading any frame`);
      return;
    }

    // Si ya tenemos datos para este frame, no necesitamos cargarlo nuevamente
    if (scene && 
        scene.frame === timestep && 
        scene.analysisId === analysisId && 
        scene.model === model && 
        scene.data !== undefined && 
        !scene.isLoading && 
        !scene.isUnavailable) {
      console.log(`[use-raster-frame] Frame ${timestep} already loaded, skipping`);
      return;
    }

    console.log(`[use-raster-frame] Loading frame for analysis ${analysisId}, model ${model}, timestep ${timestep}`);
    
    const fetchRasterFrame = async (): Promise<void> => {
      try {
        const imageData = await getRasterFrame(
          trajectoryId,
          timestep,
          analysisId,
          model
        );

        if (imageData) {
          console.log(`[use-raster-frame] Frame data loaded for analysis ${analysisId}, model ${model}, timestep ${timestep}`);
          setScene({
            frame: timestep,
            model: model,
            analysisId: analysisId,
            data: imageData,
            isLoading: false,
            isUnavailable: false
          });
        } else {
          setScene({
            frame: timestep,
            model: model,
            analysisId: analysisId,
            data: undefined,
            isLoading: false,
            isUnavailable: true
          });
      }} catch (error) {
        console.error(
          `Error fetching frame data for analysis ${analysisId}, model ${model}, frame ${timestep}:`,
          error
        );
        setScene({
          frame: timestep,
          model: model,
          analysisId: analysisId,
          data: undefined,
          isLoading: false,
          isUnavailable: true
        });
        setError(`Error fetching frame: ${error}`);
      }
    };

    fetchRasterFrame();

    return () => {
      // No need to do anything on cleanup
    };
  }, [trajectoryId, analysisId, model, timestep, getRasterFrame, scene]);

  return {
    scene,
    isLoading,
    error
  };
};

export default useRasterFrame;
