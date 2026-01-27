import type { StateCreator } from 'zustand';
import type { Trajectory } from '@/types/models';
import type { TimestepData, TimestepState, TimestepStore } from '@/types/stores/editor/timesteps';
import { getCanvasUseCases } from '@/modules/canvas/application/registry';
import type { CanvasUseCases } from '@/modules/canvas/application/registry';

const initialTimestepData: TimestepData = {
    timesteps: [],
    minTimestep: 0,
    maxTimestep: 0,
    timestepCount: 0
};

const initialState: TimestepState = {
    timestepData: initialTimestepData,
    isRenderOptionsLoading: false
};

const resolveUseCases = (): CanvasUseCases => getCanvasUseCases();

export const createTimestepSlice: StateCreator<any, [], [], TimestepStore> = (set, get) => ({
    ...initialState,

    async computeTimestepData(trajectory: Trajectory | null, _currentTimestep?: number, _cacheBuster?: number) {
        const { computeTimestepDataUseCase } = resolveUseCases();
        const timestepData = computeTimestepDataUseCase.execute(trajectory);
        set({ timestepData: timestepData ?? initialTimestepData });
    },

    loadModels: async (preloadBehavior, onProgress, maxFramesToPreload, currentFrameIndex, ids = {}) => {
        const { preloadModelsUseCase } = resolveUseCases();
        const { timestepData } = get();
        if (!timestepData.timesteps.length) return {};

        // IDs must be provided now that we don't depend on legacy stores
        const { teamId, trajectoryId } = ids;

        if (!teamId || !trajectoryId) {
            console.warn('[TimestepSlice] loadModels called without teamId or trajectoryId', { teamId, trajectoryId });
            return {};
        }

        const editorState = get();
        const activeScene = editorState.activeScene;
        const analysisId = editorState.model?.analysisId || 'default';

        const timesteps = timestepData.timesteps;
        const startIndex = currentFrameIndex || 0;
        const limit = maxFramesToPreload || timesteps.length;

        const results = await preloadModelsUseCase.execute({
            teamId,
            trajectoryId,
            timesteps,
            analysisId,
            activeScene,
            startIndex,
            limit,
            onProgress: (progress) => {
                if (onProgress) {
                    onProgress(progress, { bps: 0 });
                }
            }
        });

        return results;
    },

    resetTimesteps() {
        set(initialState);
    }
});
