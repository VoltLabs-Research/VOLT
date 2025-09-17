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
  model: string | undefined,
  priority: 'high' | 'low' = 'high' // Alta prioridad para escenas principales, baja para model rail
): UseRasterFrameResult => {
  const { getRasterFrame, getFrameCacheKey, loadingFrames, cachedFrameExists } = useRasterStore();
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);

  const cacheKey = useMemo(() => 
    trajectoryId && (timestep !== undefined && timestep !== null) && analysisId && model 
      ? getFrameCacheKey(timestep, analysisId, model)
      : null,
    [trajectoryId, timestep, analysisId, model, getFrameCacheKey]
  );

  const isLoading = cacheKey ? loadingFrames.has(cacheKey) : false;
  
  // Verificar si ya tenemos este frame en caché
  const isCached = useMemo(() => {
    if (!cacheKey) return false;
    return cachedFrameExists?.(cacheKey) || false;
  }, [cacheKey, cachedFrameExists]);

  // Reset state when parameters change
  useEffect(() => {
    // Si el timestep es -1, significa que aún no se ha seleccionado un frame
    if (timestep === -1) {
      console.log(`[use-raster-frame] Timestep is -1, showing empty state`);
      setScene(null);
      setError(null);
      return;
    }
    
    // Verificar si el frame ya está en caché para evitar mostrar el loading state
    const isFrameInCache = !!(trajectoryId && timestep !== undefined && analysisId && model && 
      (isCached || !loadingFrames.has(getFrameCacheKey(timestep, analysisId, model))));
    
    // No resetear completamente el estado al cambiar de frame, 
    // sólo marcar que está cargando pero mantener los datos anteriores visibles
    if (scene && timestep !== undefined && scene.frame !== timestep) {
      // Si es de baja prioridad, no cambiar el estado de carga para evitar skeletons en model rail
      if (priority === 'low' && scene.data) {
        console.log(`[use-raster-frame] Low priority frame change from ${scene.frame} to ${timestep}, keeping current data visible`);
        setScene({
          ...scene,
          frame: timestep,
          isLoading: false, // No mostrar loading state para model rail
          isUnavailable: false,
        });
      } else {
        console.log(`[use-raster-frame] Frame changed from ${scene.frame} to ${timestep}, loading new data`);
        // Si el frame ya está en caché, no marcarlo como loading
        setScene({
          ...scene,
          frame: timestep,
          isLoading: !isFrameInCache, // Solo marcar como loading si no está en caché
          isUnavailable: false,
        });
      }
    } else if (!scene && timestep !== undefined && analysisId && model) {
      // Si no hay escena pero tenemos datos suficientes, crear una escena inicial en estado de carga
      console.log(`[use-raster-frame] Creating initial loading scene for timestep ${timestep}, priority: ${priority}`);
      
      // Si es de baja prioridad (model rail), no mostrar el estado de carga inmediatamente
      setScene({
        frame: timestep,
        model: model,
        analysisId: analysisId,
        data: undefined, 
        isLoading: priority === 'high' ? !isFrameInCache : false, // No mostrar loading para model rail
        isUnavailable: false
      });
    } else if (!scene) {
      // Si no hay escena ni datos suficientes, resetear completamente
      setScene(null);
      setError(null);
    }
  }, [trajectoryId, timestep, analysisId, model, scene, loadingFrames, getFrameCacheKey, isCached, priority]);

  useEffect(() => {
    if (!trajectoryId || timestep === undefined || !analysisId || !model) {
      return;
    }

    // Si el timestep es -1, significa que aún no se ha seleccionado un frame, no cargar nada
    if (timestep === -1) {
      console.log(`[use-raster-frame] Timestep is -1, not loading any frame`);
      return;
    }

    // Si ya tenemos datos para este frame exacto, no necesitamos cargarlo nuevamente
    if (scene && 
        scene.frame === timestep && 
        scene.analysisId === analysisId && 
        scene.model === model && 
        scene.data !== undefined && 
        !scene.isLoading && 
        !scene.isUnavailable) {
      console.log(`[use-raster-frame] Frame ${timestep} already loaded with data, skipping fetch`);
      return;
    }

    // Si el frame ya está cargando, no necesitamos iniciar otra carga
    if (cacheKey && loadingFrames.has(cacheKey)) {
      console.log(`[use-raster-frame] Frame ${timestep} is already loading, skipping duplicate fetch`);
      return;
    }

    // Asegurarnos de que tenemos valores válidos
    const frameNumber = timestep as number;
    const frameModel = model as string;
    const frameAnalysisId = analysisId as string;
    const frameTrajectoryId = trajectoryId as string;

    // Para elements de baja prioridad (model rail), retrasar la carga si aún no tenemos datos
    if (priority === 'low' && !scene?.data) {
      console.log(`[use-raster-frame] Low priority frame ${frameNumber}, delaying load`);
      const timer = setTimeout(() => {
        fetchRasterFrame();
      }, 500); // Retrasar la carga 500ms para dar prioridad a la escena principal
      return () => clearTimeout(timer);
    }

    console.log(`[use-raster-frame] Loading frame for analysis ${frameAnalysisId}, model ${frameModel}, timestep ${frameNumber}`);
    fetchRasterFrame();
    
    function fetchRasterFrame() {
      // Marcar que está cargando sólo si es alta prioridad
      if (priority === 'high' && scene) {
        setScene(prev => prev ? { ...prev, isLoading: true } : null);
      }
      
      getRasterFrame(frameTrajectoryId, frameNumber, frameAnalysisId, frameModel)
        .then(imageData => {
          if (imageData) {
            console.log(`[use-raster-frame] Frame data loaded for analysis ${frameAnalysisId}, model ${frameModel}, timestep ${frameNumber}`);
            setScene({
              frame: frameNumber,
              model: frameModel,
              analysisId: frameAnalysisId,
              data: imageData,
              isLoading: false,
              isUnavailable: false
            });
          } else {
            setScene({
              frame: frameNumber,
              model: frameModel,
              analysisId: frameAnalysisId,
              data: undefined,
              isLoading: false,
              isUnavailable: true
            });
          }
        })
        .catch(error => {
          console.error(
            `Error fetching frame data for analysis ${frameAnalysisId}, model ${frameModel}, frame ${frameNumber}:`,
            error
          );
          setScene({
            frame: frameNumber,
            model: frameModel,
            analysisId: frameAnalysisId,
            data: undefined,
            isLoading: false,
            isUnavailable: true
          });
          setError(`Error fetching frame: ${error}`);
        });
    }

    return () => {
      // No need to do anything on cleanup
    };
  }, [trajectoryId, analysisId, model, timestep, getRasterFrame, scene, cacheKey, loadingFrames, priority]);

  return {
    scene,
    isLoading,
    error
  };
};

export default useRasterFrame;
