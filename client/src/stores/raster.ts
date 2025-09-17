import { create } from "zustand";
import { api } from "@/services/api";
import { createAsyncAction } from "@/utilities/asyncAction";
import type { ApiResponse } from "@/types/api";

interface AnalysisName {
  _id: string;
  name: string;
}

interface FrameCache {
  [key: string]: {
    data: string;
    timestamp: number;
  };
}

interface RasterState {
  trajectory: any;
  isLoading: boolean;
  isAnalysisLoading: boolean;
  analyses: Record<string, any>;
  analysesNames: AnalysisName[];
  selectedAnalysis: string | null;
  error: string | null;
  frameCache: FrameCache;
  loadingFrames: Set<string>;
  unavailableFrames: Set<string>; // Frames que no existen en el servidor
  isPreloading: boolean;
  preloadProgress: number;

  getRasterFrames: (id: string) => Promise<void>;
  getRasterFrame: (trajectoryId: string, timestep: number, analysisId: string, model: string) => Promise<string | null>;
  preloadAllFrames: (trajectoryId: string) => Promise<void>;
  clearRasterData: () => void;
  setSelectedAnalysis: (id: string | null) => void;
  clearFrameCache: () => void;
  getFrameCacheKey: (timestep: number, analysisId: string, model: string) => string;
}

const initialState = {
  trajectory: null,
  isLoading: false,
  isAnalysisLoading: false,
  analyses: {},
  analysesNames: [],
  selectedAnalysis: null,
  error: null,
  frameCache: {},
  loadingFrames: new Set<string>(),
  unavailableFrames: new Set<string>(),
  isPreloading: false,
  preloadProgress: 0,
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
      set({ isLoading: true, error: null });

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
      const { frameCache, loadingFrames, unavailableFrames } = get();
      
      // Si ya sabemos que este frame no está disponible, retornar null inmediatamente
      if (unavailableFrames.has(cacheKey)) {
        return null;
      }
      
      if (frameCache[cacheKey]) {
        const cached = frameCache[cacheKey];
        const isExpired = Date.now() - cached.timestamp > 300000;
        if (!isExpired) {
          return cached.data;
        }
      }

      if (loadingFrames.has(cacheKey)) {
        return null;
      }

      try {
        set(state => {
          const newLoadingFrames = new Set(state.loadingFrames);
          newLoadingFrames.add(cacheKey);
          return { loadingFrames: newLoadingFrames };
        });

        const res = await api.get(`/raster/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`);
        const imageData = res.data.data.data;

        set(state => {
          const newLoadingFrames = new Set(state.loadingFrames);
          newLoadingFrames.delete(cacheKey);
          
          return {
            frameCache: {
              ...state.frameCache,
              [cacheKey]: {
                data: imageData,
                timestamp: Date.now()
              }
            },
            loadingFrames: newLoadingFrames
          };
        });

        return imageData;
      } catch (error) {
        console.error("Error loading frame:", error);
        set(state => {
          const newLoadingFrames = new Set(state.loadingFrames);
          newLoadingFrames.delete(cacheKey);
          const newUnavailableFrames = new Set(state.unavailableFrames);
          
          // Si es un error 404 o similar, marcar como no disponible
          if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
            newUnavailableFrames.add(cacheKey);
          }
          
          return { 
            loadingFrames: newLoadingFrames,
            unavailableFrames: newUnavailableFrames
          };
        });
        return null;
      }
    },

    getFrameCacheKey(timestep: number, analysisId: string, model: string) {
      return `${timestep}-${analysisId}-${model}`;
    },

    clearFrameCache() {
      set({ frameCache: {}, loadingFrames: new Set(), unavailableFrames: new Set() });
    },

    setSelectedAnalysis(id) {
      set({ selectedAnalysis: id });
    },

    async preloadAllFrames(trajectoryId: string) {
      const { analyses } = get();
      if (!analyses || Object.keys(analyses).length === 0) return;

      set({ isPreloading: true, preloadProgress: 0 });

      const framesToPreload: Array<{
        timestep: number;
        analysisId: string;
        model: string;
      }> = [];

      for (const analysisId of Object.keys(analyses)) {
        const analysis = analyses[analysisId];
        if (analysis.frames) {
          for (const timestep of Object.keys(analysis.frames)) {
            const frameData = analysis.frames[timestep];
            if (frameData.availableModels) {
              for (const model of frameData.availableModels) {
                framesToPreload.push({
                  timestep: parseInt(timestep, 10),
                  analysisId,
                  model
                });
              }
            }
          }
        }
      }

      const totalFrames = framesToPreload.length;
      let completedFrames = 0;

      const concurrencyLimit = 3; // Reducido para evitar lag
      const chunks: Array<typeof framesToPreload> = [];
      
      for (let i = 0; i < framesToPreload.length; i += concurrencyLimit) {
        chunks.push(framesToPreload.slice(i, i + concurrencyLimit));
      }

      // Función para procesar con requestIdleCallback cuando esté disponible
      const processChunk = (chunk: typeof framesToPreload) => {
        return new Promise<void>((resolve) => {
          const runChunk = async () => {
            const promises = chunk.map(async ({ timestep, analysisId, model }) => {
              try {
                await get().getRasterFrame(trajectoryId, timestep, analysisId, model);
              } catch (error) {
                console.warn(`Failed to preload frame ${timestep}-${analysisId}-${model}:`, error);
              } finally {
                completedFrames++;
                const progress = Math.round((completedFrames / totalFrames) * 100);
                set({ preloadProgress: progress });
              }
            });

            await Promise.all(promises);
            resolve();
          };

          // Usar requestIdleCallback si está disponible, sino setTimeout
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => runChunk());
          } else {
            setTimeout(() => runChunk(), 0);
          }
        });
      };

      // Procesar chunks con delay para no bloquear el main thread
      for (let i = 0; i < chunks.length; i++) {
        await processChunk(chunks[i]);
        
        // Pequeño delay entre chunks para dar espacio al main thread
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      set({ isPreloading: false, preloadProgress: 100 });
    },

    clearRasterData() {
      set({
        trajectory: null,
        analyses: {},
        analysesNames: [],
        selectedAnalysis: null,
        error: null,
        frameCache: {},
        loadingFrames: new Set(),
        unavailableFrames: new Set(),
        isPreloading: false,
        preloadProgress: 0,
      });
    },
  };
});

export default useRasterStore;
