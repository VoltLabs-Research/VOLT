import { create } from 'zustand';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { ApiResponse } from '@/types/api';

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
  preloadedTrajectoriesMap: Record<string, boolean>;

  getRasterFrames: (id: string) => Promise<void>;
  getRasterFrame: (trajectoryId: string, timestep: number, analysisId: string, model: string) => Promise<string | null>;
  preloadAllFrames: (trajectoryId: string) => Promise<void>;
  preloadPriorizedFrames: (
    trajectoryId: string,
    priorityModels: { ml?: string; mr?: string },
    currentTimestep?: number
  ) => Promise<void>;
  clearRasterData: () => void;
  setSelectedAnalysis: (id: string | null) => void;
  getFrameCacheKey: (timestep: number, analysisId: string, model: string) => string;
  cachedFrameExists: (cacheKey: string) => boolean;
  resetPreloadState: (trajectoryId: string) => void;
  clearFrameCache: () => void;
}

const initialState: Omit<RasterState, keyof RasterState> = {
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
  preloadedTrajectoriesMap: {},
} as any;

const useRasterStore = create<RasterState>((set, get) => {
  const asyncAction = createAsyncAction(set, get);

  return {
    ...initialState,

    rasterize: (id: string) =>
      asyncAction(() => api.post<ApiResponse<any>>(`/raster/${id}/glb/`), {
        loadingKey: 'isAnalysisLoading',
        onSuccess: (res) => ({ analyses: res.data.data.analyses }),
      }),

    async getRasterFrames(id: string) {
      set({ isLoading: true, error: null });
      try {
        const res = await api.get(`/raster/${id}/metadata`);
        const { analyses, trajectory } = res.data.data;

        const analysesNames = Object.values(analyses).map((a: any) => ({
          _id: a._id,
          name: `${a.identificationMode}${a.identificationMode === 'PTM' ? ` - RMSD: ${a.RMSD}` : ''}`,
        }));

        set({
          trajectory,
          analyses,
          analysesNames,
          isLoading: false,
          error: null,
          selectedAnalysis: analysesNames.length > 0 ? analysesNames[0]._id : null,
        });
      } catch (e: any) {
        console.error('Error loading raster metadata:', e);
        set({ isLoading: false, error: e?.message ?? 'Unknown error' });
      }
    },

    async getRasterFrame(trajectoryId, timestep, analysisId, model) {
      const cacheKey = get().getFrameCacheKey(timestep, analysisId, model);
      set((s) => ({ loadingFrames: new Set(s.loadingFrames).add(cacheKey) }));
      try {
        const res = await api.get(`/raster/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`);
        const imageData = res.data.data.data;
        set((s) => {
          const lf = new Set(s.loadingFrames);
          lf.delete(cacheKey);
          return { loadingFrames: lf };
        });
        return imageData ?? null;
      } catch (e: any) {
        console.error('Error loading frame:', e);
        set((s) => {
          const lf = new Set(s.loadingFrames);
          lf.delete(cacheKey);
          return { loadingFrames: lf, error: e?.message ?? 'Error loading frame' };
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
      const parts = cacheKey.split('-');
      if (parts.length !== 3) return false;
      const [timestepStr, analysisId, model] = parts;
      const ts = Number(timestepStr);
      if (!Number.isFinite(ts)) return false;

      const analysis = analyses[analysisId];
      if (!analysis?.frames) return false;
      const frame = analysis.frames[String(ts)] ?? analysis.frames[ts]; // support string/number keys
      const available = (frame?.availableModels as string[]) ?? [];
      return available.includes(model);
    },

    clearFrameCache() {
      set({ loadingFrames: new Set() });
    },

    setSelectedAnalysis(id) {
      set({ selectedAnalysis: id });
    },

    async preloadPriorizedFrames(trajectoryId, priorityModels, currentTimestep) {
      const { analyses, preloadedTrajectoriesMap, isPreloading, getFrameCacheKey, loadingFrames } = get();

      if (!analyses || !Object.keys(analyses).length) return;
      if (isPreloading) return;

      const priorityKey = JSON.stringify({
        ml: priorityModels.ml ?? 'default',
        mr: priorityModels.mr ?? 'default',
        ts: currentTimestep ?? 'all',
      });
      const mapKey = `${trajectoryId}-${priorityKey}`;
      if (preloadedTrajectoriesMap[mapKey]) return;

      set({ isPreloading: true, preloadProgress: 0 });

      // Collect all frame tasks with a simple priority score
      type Task = { timestep: number; analysisId: string; model: string; score: number };
      const tasks: Task[] = [];

      for (const analysisId of Object.keys(analyses)) {
        const frames = analyses[analysisId]?.frames || {};
        for (const k of Object.keys(frames)) {
          const ts = parseInt(k, 10);
          if (!Number.isFinite(ts)) continue;
          const models: string[] = frames[k]?.availableModels || [];
          for (const model of models) {
            const key = getFrameCacheKey(ts, analysisId, model);
            if (loadingFrames.has(key)) continue;

            let score = 100;
            if (currentTimestep !== undefined && ts === currentTimestep) score -= 80; // highest priority
            if (priorityModels.ml && model === priorityModels.ml) score -= 30;
            if (priorityModels.mr && model === priorityModels.mr) score -= 30;
            if (model === 'dislocations') score -= 20;
            if (model === 'preview') score -= 5;

            tasks.push({ timestep: ts, analysisId, model, score });
          }
        }
      }

      tasks.sort((a, b) => a.score - b.score);
      const total = tasks.length;
      if (!total) {
        set({ isPreloading: false, preloadProgress: 100 });
        return;
      }

      let done = 0;

      // Process in small concurrent batches
      const runBatch = async (batch: Task[]) => {
        await Promise.all(
          batch.map(async (t) => {
            try {
              await get().getRasterFrame(trajectoryId, t.timestep, t.analysisId, t.model);
            } catch {
              // ignore single task error
            } finally {
              done++;
              const progress = Math.round((done / total) * 100);
              set({ preloadProgress: progress });
            }
          })
        );
      };

      const chunk = 4; // simple fixed concurrency
      for (let i = 0; i < tasks.length; i += chunk) {
        // eslint-disable-next-line no-await-in-loop
        await runBatch(tasks.slice(i, i + chunk));
      }

      set((s) => ({
        isPreloading: false,
        preloadProgress: 100,
        preloadedTrajectoriesMap: { ...s.preloadedTrajectoriesMap, [mapKey]: true },
      }));
    },

    async preloadAllFrames(trajectoryId: string) {
      return get().preloadPriorizedFrames(trajectoryId, {});
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
      });
    },

    resetPreloadState(trajectoryId: string) {
      set((s) => {
        const copy = { ...s.preloadedTrajectoriesMap };
        for (const k of Object.keys(copy)) {
          if (k.startsWith(`${trajectoryId}-`)) delete copy[k];
        }
        return { preloadedTrajectoriesMap: copy };
      });
    },
  };
});

export default useRasterStore;
