import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import { RasterMetadataService } from '../../domain/services/RasterMetadataService';
import { getRasterUseCases } from '../../application/registry';
import type { RasterUseCases } from '../../application/registry';

export interface RasterState {
    trajectory: any | null;
    isLoading: boolean;
    isAnalysisLoading: boolean;
    analyses: Record<string, any>;
    analysesNames: any[];
    selectedAnalysis: string | null;
    error: string | null;
    loadingFrames: Set<string>;
    isPreloading: boolean;
    preloadProgress: number;
    frameCache: Record<string, any>;
}

export interface RasterActions {
    rasterize: (id: string) => Promise<void>;
    getRasterFrames: (id: string) => Promise<void>;
    getRasterFrame: (trajectoryId: string, timestep: number, analysisId: string, model: string) => Promise<any>;
    getFrameCacheKey: (ts: number, aid: string, model: string) => string;
    clearFrameCache: () => void;
    preloadPriorizedFrames: (trajectoryId: string, priorityModels: any, currentTs?: number) => Promise<void>;
    preloadAllFrames: (trajectoryId: string) => Promise<void>;
}

export type RasterSlice = RasterState & RasterActions;

export const initialState: RasterState = {
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
    frameCache: {}
};

const resolveUseCases = (): RasterUseCases => getRasterUseCases();
const metadataService = new RasterMetadataService();

export const createRasterSlice: SliceCreator<RasterSlice> = (set, get) => ({
    ...initialState,

    rasterize: async (id) => {
        const { generateRasterUseCase } = resolveUseCases();
        await runRequest(set, get, () => generateRasterUseCase.execute(id), {
            loadingKey: 'isAnalysisLoading',
            errorFallback: 'An unknown error occurred',
            rethrow: true,
            successMessage: 'Rasterization completed successfully',
            onSuccess: (analyses) => set({ analyses } as Partial<RasterSlice>)
        });
    },

    getRasterFrames: async (id) => {
        const { getRasterMetadataUseCase } = resolveUseCases();
        await runRequest(set, get, () => getRasterMetadataUseCase.execute(id), {
            errorFallback: 'Unknown error',
            loadingKey: 'isLoading',
            onSuccess: (metadata: any) => {
                const normalized = metadataService.normalize(metadata, new Date().toISOString());
                set({
                    trajectory: normalized.trajectory,
                    analyses: normalized.analyses,
                    analysesNames: normalized.analysesNames,
                    selectedAnalysis: normalized.selectedAnalysis
                } as Partial<RasterSlice>);
            }
        });
    },

    getRasterFrame: async (trajectoryId, timestep, analysisId, model) => {
        const { getRasterFrameDataUseCase } = resolveUseCases();
        const s = get();
        const key = s.getFrameCacheKey(timestep, analysisId, model);
        const cached = s.frameCache?.[key];
        if (cached) return cached;

        const frames = s.analyses?.[analysisId]?.frames?.[timestep];
        if (!frames?.availableModels?.includes(model)) return null;

        set((st: RasterSlice) => ({ loadingFrames: new Set(st.loadingFrames).add(key) }));

        try {
            const data = await getRasterFrameDataUseCase.execute(trajectoryId, timestep, analysisId, model);
            set((st: RasterSlice) => {
                const loadingFrames = new Set(st.loadingFrames); 
                loadingFrames.delete(key);
                return { 
                    loadingFrames, 
                    frameCache: { ...st.frameCache, ...(data ? { [key]: data } : {}) } 
                };
            });
            return data ?? null;
        } catch (e: any) {
            set((st: RasterSlice) => { 
                const lf = new Set(st.loadingFrames); 
                lf.delete(key); 
                return { loadingFrames: lf }; 
            });
            return null;
        }
    },

    getFrameCacheKey: (ts, aid, model) => `${ts}-${aid}-${model}`,
    
    clearFrameCache: () => set({ loadingFrames: new Set(), frameCache: {} } as Partial<RasterSlice>),

    preloadPriorizedFrames: async (trajectoryId, priorityModels, currentTs) => {
        const s = get();
        if (!s.analyses || !Object.keys(s.analyses).length || s.isPreloading) return;
        const { preloadFramesUseCase } = resolveUseCases();

        const preloadParams = {
            analyses: s.analyses,
            existingCache: s.frameCache,
            loadingFrames: s.loadingFrames,
            priorityModels,
            currentTimestep: currentTs
        };

        const tasks = preloadFramesUseCase.buildTaskList(preloadParams);

        if (!tasks.length) {
            set({ isPreloading: false, preloadProgress: 100 } as Partial<RasterSlice>);
            return;
        }

        set((state: RasterSlice) => {
            const loadingFrames = new Set(state.loadingFrames);
            tasks.forEach((task) => {
                const key = state.getFrameCacheKey(task.timestep, task.analysisId, task.model);
                loadingFrames.add(key);
            });

            return {
                isPreloading: true,
                preloadProgress: 0,
                loadingFrames
            } as Partial<RasterSlice>;
        });

        await preloadFramesUseCase.execute(trajectoryId, preloadParams, {
            tasks,
            onProgress: (progress) => {
                set({ preloadProgress: progress } as Partial<RasterSlice>);
            },
            onFrameLoaded: (task, data) => {
                const key = get().getFrameCacheKey(task.timestep, task.analysisId, task.model);
                set((state: RasterSlice) => {
                    const loadingFrames = new Set(state.loadingFrames);
                    loadingFrames.delete(key);
                    return {
                        loadingFrames,
                        frameCache: data ? { ...state.frameCache, [key]: data } : state.frameCache
                    } as Partial<RasterSlice>;
                });
            }
        });

        set({ isPreloading: false, preloadProgress: 100 } as Partial<RasterSlice>);
    },

    preloadAllFrames: async (trajectoryId) => {
        await get().preloadPriorizedFrames(trajectoryId, {});
    }
});
