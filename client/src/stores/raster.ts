import { create } from "zustand";
import { api } from "@/services/api";
import { createAsyncAction } from "@/utilities/asyncAction";
import type { ApiResponse } from "@/types/api";

interface AnalysisName {
  _id: string;
  name: string;
}

interface RasterState {
  trajectory: any;
  isLoading: boolean;
  isAnalysisLoading: boolean;
  analyses: Record<string, any>;
  analysesNames: AnalysisName[];
  selectedAnalysis: string | null;
  error: string | null;
  loadingFrames: Set<string>;
  isPreloading: boolean;
  preloadProgress: number;
  preloadedTrajectoriesMap: Record<string, boolean>; // Map para almacenar qué trayectorias ya se han precargado

  getRasterFrames: (id: string) => Promise<void>;
  getRasterFrame: (trajectoryId: string, timestep: number, analysisId: string, model: string) => Promise<string | null>;
  preloadAllFrames: (trajectoryId: string) => Promise<void>;
  preloadPriorizedFrames: (trajectoryId: string, priorityModels: { ml?: string; mr?: string }, currentTimestep?: number) => Promise<void>;
  clearRasterData: () => void;
  setSelectedAnalysis: (id: string | null) => void;
  getFrameCacheKey: (timestep: number, analysisId: string, model: string) => string;
  cachedFrameExists: (cacheKey: string) => boolean;
  resetPreloadState: (trajectoryId: string) => void; // Nueva función para resetear el estado de precarga
}

const initialState = {
  trajectory: null,
  isLoading: false,
  isAnalysisLoading: false,
  analyses: {},
  analysesNames: [],
  selectedAnalysis: null,
  error: null,
  loadingFrames: new Set<string>(),
  isPreloading: false,
  preloadProgress: 0,
  preloadedTrajectoriesMap: {} as Record<string, boolean>, // Inicializamos como un objeto vacío
};

const useRasterStore = create<RasterState>((set, get) => {
  const asyncAction = createAsyncAction(set, get);

  return {
    ...initialState,

    rasterize: (id: string) =>
      asyncAction(() => api.post<ApiResponse<any>>(`/raster/${id}/glb/`), {
        loadingKey: "isAnalysisLoading",
        onSuccess: (res) => {
          return { analyses: res.data.data.analyses };
        },
      }),

    async getRasterFrames(id: string) {
      set({ 
        isLoading: true, 
        error: null
      });

      try {
        const res = await api.get(`/raster/${id}/metadata`);
        const { analyses, trajectory } = res.data.data;

        const analysesNames = Object.values(analyses).map((a: any) => ({
          _id: a._id,
          name: `${a.identificationMode}${
            a.identificationMode === "PTM" ? ` - RMSD: ${a.RMSD}` : ""
          }`,
        }));

        set({
          trajectory,
          analyses,
          analysesNames,
          isLoading: false, 
          error: null,
          selectedAnalysis: analysesNames.length > 0 ? analysesNames[0]._id : null,
        });
      } catch (error) {
        console.error("Error loading raster metadata:", error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },

    async getRasterFrame(trajectoryId: string, timestep: number, analysisId: string, model: string) {
      const cacheKey = get().getFrameCacheKey(timestep, analysisId, model);
      
      // Marcar que está cargando este frame
      set(state => ({ 
        loadingFrames: new Set(state.loadingFrames).add(cacheKey) 
      }));
      
      try {
        // Hacer la petición al servidor directamente sin cache
        const res = await api.get(`/raster/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`);
        const imageData = res.data.data.data;
        
        // Eliminar el frame de los frames en carga
        set(state => {
          const newLoadingFrames = new Set(state.loadingFrames);
          newLoadingFrames.delete(cacheKey);
          return { loadingFrames: newLoadingFrames };
        });
        
        return imageData;
      } catch (error) {
        console.error("Error loading frame:", error);
        
        // Eliminar el frame de los frames en carga incluso en error
        set(state => {
          const newLoadingFrames = new Set(state.loadingFrames);
          newLoadingFrames.delete(cacheKey);
          return { 
            loadingFrames: newLoadingFrames,
            error: error instanceof Error ? error.message : "Error loading frame"
          };
        });
        
        return null;
      }
    },

    getFrameCacheKey(timestep: number, analysisId: string, model: string) {
      return `${timestep}-${analysisId}-${model}`;
    },

    cachedFrameExists(cacheKey: string) {
      const { analyses } = get();
      if (!cacheKey || !analyses) return false;
      
      // El cacheKey es de la forma 'timestep-analysisId-model'
      const parts = cacheKey.split('-');
      if (parts.length !== 3) return false;
      
      const [timestep, analysisId, model] = parts;
      
      // Verificar si tenemos el análisis
      if (!analyses[analysisId]) return false;
      
      // Verificar si tenemos el frame para ese timestep
      if (!analyses[analysisId].frames || !analyses[analysisId].frames[timestep]) return false;
      
      // Verificar si el modelo está disponible para ese frame
      const availableModels = analyses[analysisId].frames[timestep].availableModels || [];
      return availableModels.includes(model);
    },

    clearFrameCache() {
      set({ loadingFrames: new Set() });
    },

    setSelectedAnalysis(id) {
      set({ selectedAnalysis: id });
    },

    async preloadPriorizedFrames(trajectoryId: string, priorityModels: { ml?: string; mr?: string }, currentTimestep?: number) {
      const { analyses, preloadedTrajectoriesMap, isPreloading } = get();
      if (!analyses || Object.keys(analyses).length === 0) {
        console.log(`[useRasterStore] No analyses available for trajectory ${trajectoryId}, skipping preload`);
        return;
      }
      
      // Si ya hay una precarga en curso, no iniciar otra
      if (isPreloading) {
        console.log(`[useRasterStore] Another preload is already in progress, skipping new request for ${trajectoryId}`);
        return;
      }
      
      // Generar una clave única para esta combinación de trayectoria y modelos prioritarios
      const priorityKey = JSON.stringify({
        ml: priorityModels.ml || 'default',
        mr: priorityModels.mr || 'default',
        ts: currentTimestep || 'all'
      });
      const cacheKey = `${trajectoryId}-${priorityKey}`;
      
      // Verificar si ya hemos precargado esta combinación específica
      if (preloadedTrajectoriesMap[cacheKey]) {
        console.log(`[useRasterStore] Trajectory ${trajectoryId} with models ${priorityKey} already preloaded, skipping`);
        return;
      }

      console.log(`[useRasterStore] Starting preload for trajectory ${trajectoryId} with priority models: ${priorityKey}`);
      set({ isPreloading: true, preloadProgress: 0 });

      // Organizar frames por prioridad
      const currentTimestepFrames: Array<{
        timestep: number;
        analysisId: string;
        model: string;
        priority: number;
      }> = [];
      
      const priorityFrames: Array<{
        timestep: number;
        analysisId: string;
        model: string;
        priority: number; // 1 = highest, 2 = medium, 3 = lowest
      }> = [];
      
      const otherFrames: Array<{
        timestep: number;
        analysisId: string;
        model: string;
        priority: number;
      }> = [];

      try {
        // Primero recopilar todos los frames disponibles
        for (const analysisId of Object.keys(analyses)) {
          const analysis = analyses[analysisId];
          if (!analysis.frames) continue;
          
          for (const timestep of Object.keys(analysis.frames)) {
            const frameData = analysis.frames[timestep];
            if (!frameData.availableModels) continue;
            
            for (const model of frameData.availableModels) {
              const frameTimestep = parseInt(timestep, 10);
              if (isNaN(frameTimestep)) continue; // Saltear timesteps inválidos
              
              const isCurrentTimestep = currentTimestep !== undefined && frameTimestep === currentTimestep;
              
              // Verificar si este frame ya está cargando o cargado
              const frameCacheKey = get().getFrameCacheKey(frameTimestep, analysisId, model);
              const isLoading = get().loadingFrames.has(frameCacheKey);
              
              if (isLoading) {
                console.log(`[useRasterStore] Frame ${frameCacheKey} is already loading, skipping in preload`);
                continue;
              }
              
              // Si es el timestep actual y es "dislocations", es la máxima prioridad
              if (isCurrentTimestep && model === 'dislocations') {
                currentTimestepFrames.push({
                  timestep: frameTimestep,
                  analysisId,
                  model,
                  priority: 0 // Prioridad máxima
                });
                continue;
              }
              
              // Si es el timestep actual con cualquier modelo, también es alta prioridad
              if (isCurrentTimestep) {
                currentTimestepFrames.push({
                  timestep: frameTimestep,
                  analysisId,
                  model,
                  priority: 1 // Alta prioridad
                });
                continue;
              }

              const frame = {
                timestep: frameTimestep,
                analysisId,
                model,
                priority: 3 // default low priority
              };

              // Asignar prioridad alta a los modelos del usuario
              const isPriorityModel = 
                (priorityModels.ml && model === priorityModels.ml) ||
                (priorityModels.mr && model === priorityModels.mr);

              if (isPriorityModel) {
                frame.priority = 2; // Prioridad para modelos solicitados
                priorityFrames.push(frame);
              } else if (model === 'dislocations') {
                frame.priority = 2; // Prioridad para dislocations
                priorityFrames.push(frame);
              } else if (model === 'preview') {
                frame.priority = 3; // Prioridad media para preview
                otherFrames.push(frame);
              } else {
                frame.priority = 4; // Baja prioridad base
                otherFrames.push(frame);
              }
            }
          }
        }

        // Ordenar por prioridad
        currentTimestepFrames.sort((a, b) => a.priority - b.priority);
        priorityFrames.sort((a, b) => a.priority - b.priority || a.timestep - b.timestep);
        otherFrames.sort((a, b) => a.priority - b.priority || a.timestep - b.timestep);

        // Combinar: primero el timestep actual, luego priority frames, luego otros
        const allFrames = [...currentTimestepFrames, ...priorityFrames, ...otherFrames];
        const totalFrames = allFrames.length;
        
        if (totalFrames === 0) {
          console.log(`[useRasterStore] No frames to preload for trajectory ${trajectoryId}`);
          set({ isPreloading: false, preloadProgress: 100 });
          return;
        }
        
        console.log(`[useRasterStore] Found ${totalFrames} frames to preload (${currentTimestepFrames.length} current, ${priorityFrames.length} priority, ${otherFrames.length} other)`);
        
        let completedFrames = 0;

        // Cargar inmediatamente el frame actual primero
        if (currentTimestepFrames.length > 0) {
          try {
            // Cargar los frames del timestep actual de forma síncrona, uno por uno
            for (const frame of currentTimestepFrames) {
              // Verificar si el store todavía existe (por si el componente se desmontó)
              if (!get) {
                console.log(`[useRasterStore] Store no longer exists, aborting preload`);
                return;
              }
              
              await get().getRasterFrame(trajectoryId, frame.timestep, frame.analysisId, frame.model);
              completedFrames++;
              const progress = Math.round((completedFrames / totalFrames) * 100);
              set({ preloadProgress: progress });
            }
          } catch (error) {
            console.error(`[useRasterStore] Error loading current timestep frame:`, error);
          }
        }

        // Procesar el resto de frames
        const processFrames = async (frames: typeof priorityFrames, concurrency: number, isHighPriority = false) => {
          const chunks: Array<typeof frames> = [];
          
          for (let i = 0; i < frames.length; i += concurrency) {
            chunks.push(frames.slice(i, i + concurrency));
          }

          const processChunk = (chunk: typeof frames) => {
            return new Promise<void>((resolve) => {
              const runChunk = async () => {
                const promises = chunk.map(async ({ timestep, analysisId, model }) => {
                  try {
                    // Verificar si el store todavía existe (por si el componente se desmontó)
                    if (!get) {
                      console.log(`[useRasterStore] Store no longer exists, aborting preload`);
                      return;
                    }
                    
                    // Verificar si este frame ya está cargando o cargado antes de intentar cargarlo
                    const frameCacheKey = get().getFrameCacheKey(timestep, analysisId, model);
                    const isLoading = get().loadingFrames.has(frameCacheKey);
                    
                    if (isLoading) {
                      console.log(`[useRasterStore] Frame ${frameCacheKey} is already loading, skipping in chunk processing`);
                      completedFrames++;
                      return;
                    }
                    
                    await get().getRasterFrame(trajectoryId, timestep, analysisId, model);
                  } catch (error) {
                    console.warn(`[useRasterStore] Failed to preload frame ${timestep}-${analysisId}-${model}:`, error);
                  } finally {
                    completedFrames++;
                    const progress = Math.round((completedFrames / totalFrames) * 100);
                    set({ preloadProgress: progress });
                  }
                });

                await Promise.all(promises);
                resolve();
              };

              // Frames de alta prioridad se procesan inmediatamente
              if (isHighPriority) {
                runChunk();
              } else {
                // Otros frames usan requestIdleCallback o setTimeout como fallback
                if (typeof requestIdleCallback !== 'undefined') {
                  requestIdleCallback(() => runChunk());
                } else {
                  setTimeout(() => runChunk(), 0);
                }
              }
            });
          };

          // Procesar chunks
          for (let i = 0; i < chunks.length; i++) {
            // Verificar si el store todavía existe antes de procesar cada chunk
            if (!get) {
              console.log(`[useRasterStore] Store no longer exists, aborting chunk processing`);
              return;
            }
            
            await processChunk(chunks[i]);
            
            // Delay menor para frames de alta prioridad
            const delay = isHighPriority ? 20 : 100;
            if (i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        };

        // Procesar frames prioritarios primero con mayor concurrencia
        if (priorityFrames.length > 0) {
          await processFrames(priorityFrames, 3, true); // Mayor concurrencia para frames prioritarios
        }

        // Luego procesar otros frames con menor concurrencia
        if (otherFrames.length > 0) {
          await processFrames(otherFrames, 2, false);
        }

        // Marcar esta trayectoria como precargada para evitar futuras precargas innecesarias
        set((state) => ({ 
          isPreloading: false, 
          preloadProgress: 100,
          preloadedTrajectoriesMap: {
            ...state.preloadedTrajectoriesMap,
            [cacheKey]: true
          }
        }));
        
        console.log(`[useRasterStore] Completed preload for trajectory ${trajectoryId} with models ${priorityKey}`);
      } catch (error) {
        console.error(`[useRasterStore] Error during preload:`, error);
        // Asegurarse de resetear el estado de precarga incluso en caso de error
        set({ isPreloading: false });
      }
    },

    async preloadAllFrames(trajectoryId: string) {
      // Mantener la función original como fallback
      return this.preloadPriorizedFrames(trajectoryId, {});
    },

    clearRasterData() {
      set({
        trajectory: null,
        analyses: {},
        analysesNames: [],
        selectedAnalysis: null,
        error: null,
        loadingFrames: new Set(),
        isPreloading: false,
        preloadProgress: 0,
        // Mantenemos el mapa de trayectorias precargadas
      });
    },
    
    resetPreloadState(trajectoryId: string) {
      set(state => {
        // Filtrar todas las entradas que pertenecen a esta trayectoria
        const newPreloadedTrajectoriesMap = { ...state.preloadedTrajectoriesMap };
        const keysToRemove = Object.keys(newPreloadedTrajectoriesMap).filter(key => key.startsWith(`${trajectoryId}-`));
        
        keysToRemove.forEach(key => {
          delete newPreloadedTrajectoriesMap[key];
        });
        
        return {
          preloadedTrajectoriesMap: newPreloadedTrajectoriesMap
        };
      });
    },
  };
});

export default useRasterStore;
