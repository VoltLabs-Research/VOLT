import type { PreloadTask, RasterStore, RasterState } from '@/types/stores/raster';
import { runRequest } from '@/stores/helpers';
import type { SliceCreator } from '@/stores/helpers/create-slice';
import rasterApi from '../api/raster';

export const initialState: RasterState = {
    trajectory: null, isLoading: false, isAnalysisLoading: false, analyses: {}, analysesNames: [],
    selectedAnalysis: null, error: null, loadingFrames: new Set<string>(), isPreloading: false, preloadProgress: 0, frameCache: {}
};

function calcPreloadScore(ts: number, model: string, currentTs?: number, priorityModels?: { ml?: string; mr?: string }): number {
    let score = 100;
    if (currentTs !== undefined) { const d = Math.abs(ts - currentTs); score -= d === 0 ? 90 : d <= 1 ? 70 : d <= 3 ? 50 : d <= 5 ? 30 : 0; }
    if (priorityModels?.ml === model || priorityModels?.mr === model) score -= 40;
    if (model === 'dislocations') score -= 10;
    return score;
}

export const createRasterSlice: SliceCreator<RasterStore> = (set, get) => ({
    ...initialState,

    rasterize: async (id) => {
        await runRequest(set, get, () => rasterApi.generateGLB(id), {
            loadingKey: 'isAnalysisLoading', errorFallback: 'An unknown error occurred', rethrow: true,
            successMessage: 'Rasterization completed successfully',
            onSuccess: (analyses) => set({ analyses } as Partial<RasterStore>)
        });
    },

    getRasterFrames: async (id) => {
        await runRequest(set, get, () => rasterApi.getMetadata(id), {
            errorFallback: 'Unknown error',
            loadingKey: 'isLoading',
            onSuccess: ({ analyses, trajectory }) => {
                let names = Object.values(analyses).map((a: any) => a);
                let finalAnalyses = analyses;
                if (names.length === 0 && trajectory?.frames?.length > 0) {
                    const previewFrames: Record<string, any> = {};
                    trajectory.frames.forEach((f: any) => { previewFrames[f.timestep] = { timestep: f.timestep, availableModels: ['preview'] }; });
                    finalAnalyses = { __preview__: { _id: '__preview__', frames: previewFrames } };
                    names = [{ _id: '__preview__', modifier: 'Preview', config: {}, createdAt: new Date().toISOString() }];
                }
                set({ trajectory, analyses: finalAnalyses, analysesNames: names, selectedAnalysis: names[0]?._id || null } as Partial<RasterStore>);
            }
        });
    },

    getRasterFrame: async (trajectoryId, timestep, analysisId, model) => {
        const s = get() as RasterStore;
        const key = s.getFrameCacheKey(timestep, analysisId, model);
        const cached = s.frameCache?.[key];
        if (cached) return cached;

        const frames = s.analyses?.[analysisId]?.frames?.[timestep];
        // Don't request if model is not in availableModels
        if (!frames?.availableModels?.includes(model)) return null;

        set((st: RasterStore) => ({ loadingFrames: new Set(st.loadingFrames).add(key) }));

        try {
            const data = await rasterApi.getFrameData(trajectoryId, timestep, analysisId, model);
            set((st: RasterStore) => {
                const loadingFrames = new Set(st.loadingFrames); loadingFrames.delete(key);
                return { loadingFrames, frameCache: { ...st.frameCache, ...(data?.data ? { [key]: data.data } : {}) } };
            });
            return data?.data ?? null;
        } catch (e: any) {
            set((st: RasterStore) => { const lf = new Set(st.loadingFrames); lf.delete(key); return { loadingFrames: lf }; });
            // Don't set error for 404s - model simply not available/rasterized yet
            return null;
        }
    },

    getFrameCacheKey: (ts, aid, model) => `${ts}-${aid}-${model}`,
    clearFrameCache: () => set({ loadingFrames: new Set(), frameCache: {} } as Partial<RasterStore>),

    preloadPriorizedFrames: async (trajectoryId, priorityModels, currentTs) => {
        const s = get() as RasterStore;
        if (!s.analyses || !Object.keys(s.analyses).length || s.isPreloading) return;

        set({ isPreloading: true, preloadProgress: 0 } as Partial<RasterStore>);

        const tasks: PreloadTask[] = [];
        for (const aid of Object.keys(s.analyses)) {
            const frames = s.analyses[aid]?.frames || {};
            for (const tsStr of Object.keys(frames)) {
                const ts = parseInt(tsStr, 10);
                if (!Number.isFinite(ts)) continue;
                for (const model of frames[tsStr]?.availableModels || []) {
                    if (model === 'preview') continue;
                    const key = s.getFrameCacheKey(ts, aid, model);
                    if (s.loadingFrames.has(key) || s.frameCache?.[key]) continue;
                    tasks.push({ timestep: ts, analysisId: aid, model, score: calcPreloadScore(ts, model, currentTs, priorityModels) });
                }
            }
        }
        tasks.sort((a, b) => a.score - b.score);

        if (!tasks.length) { set({ isPreloading: false, preloadProgress: 100 } as Partial<RasterStore>); return; }

        const hw = (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) || 8;
        const chunk = Math.max(6, Math.min(16, hw));
        let done = 0;

        for (let i = 0; i < tasks.length; i += chunk) {
            await Promise.all(tasks.slice(i, i + chunk).map(async t => {
                try { await (get() as RasterStore).getRasterFrame(trajectoryId, t.timestep, t.analysisId, t.model); } catch { }
                finally { done++; set({ preloadProgress: Math.round((done / tasks.length) * 100) } as Partial<RasterStore>); }
            }));
        }
        set({ isPreloading: false, preloadProgress: 100 } as Partial<RasterStore>);
    },

    preloadAllFrames: async (trajectoryId) => (get() as RasterStore).preloadPriorizedFrames(trajectoryId, {})
});
