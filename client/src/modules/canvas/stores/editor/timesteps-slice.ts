import { preloadFractalSceneAsset } from '@/modules/fractal/api/service/preload-scene-asset';

import type { EditorStore } from './types';
import type { TimestepData, TimestepState, TimestepStore, SceneObjectType } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { TimestepInfo, Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { StateCreator } from 'zustand';

const initialTimestepData: TimestepData = {
    timesteps: [],
    minTimestep: 0,
    maxTimestep: 0,
    timestepCount: 0
};

const createInitialState = (): TimestepState => ({
    timestepData: initialTimestepData,
    isRenderOptionsLoading: false
});

const extractTimestepsWorker = (frames: TimestepInfo[], allowedTimesteps?: number[]): number[] => {
    if (!frames || frames.length === 0) return [];

    const allowedTimestepsSet = allowedTimesteps ? new Set(allowedTimesteps) : undefined;
    const resolvedTimesteps = frames
        .map((frame) => frame.timestep)
        .filter((timestep) => {
            if (allowedTimestepsSet) {
                return allowedTimestepsSet.has(timestep);
            }

            return true;
        });

    return Array.from(new Set(resolvedTimesteps)).sort((a, b) => a - b);
};

const createTimestepData = (timesteps: number[]): TimestepData => ({
    timesteps,
    minTimestep: timesteps[0] || 0,
    maxTimestep: timesteps[timesteps.length - 1] || 0,
    timestepCount: timesteps.length,
});

const getAnalysisIdFromScene = (scene: SceneObjectType): string => {
    if ('analysisId' in scene && scene.analysisId) {
        return scene.analysisId;
    }
    return 'default';
};

export const createTimestepSlice: StateCreator<EditorStore, [], [], TimestepStore> = (set, get) => ({
    ...createInitialState(),

    async computeTimestepData(trajectory: Trajectory | null, _currentTimestep?: number, _cacheBuster?: number, allowedTimesteps?: number[]) {
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            set({
                timestepData: initialTimestepData,
                isRenderOptionsLoading: false
            });
            return;
        }

        const timesteps = extractTimestepsWorker(trajectory.frames, allowedTimesteps);
        const timestepData = createTimestepData(timesteps);

        set({
            timestepData,
            isRenderOptionsLoading: false
        });
    },

    loadModels: async (_preloadBehavior, onProgress, maxFramesToPreload, currentFrameIndex, signal) => {
        const { timestepData } = get();
        if (!timestepData.timesteps.length) return {};

        const { useTeamStore } = await import('@/modules/team/stores/team/use-team-store');
        const { useEditorStore } = await import('@/modules/canvas/stores/editor');
        const { default: queryClient } = await import('@/shared/infrastructure/query/query-client');
        const { TRAJECTORY_QUERY_KEYS } = await import('@/modules/trajectory/hooks/trajectory/queries');

        const teamId = useTeamStore.getState().selectedTeamId;

        const trajectoryQueries = queryClient.getQueriesData<{ _id?: string }>({
            queryKey: TRAJECTORY_QUERY_KEYS.trajectory()
        });
        const trajectoryId = trajectoryQueries.length > 0
            ? trajectoryQueries[trajectoryQueries.length - 1]?.[1]?._id
            : undefined;

        const editorState = useEditorStore.getState();
        const activeScene = editorState.activeScene;
        const analysisId = getAnalysisIdFromScene(activeScene);

        if (!teamId || !trajectoryId) return {};

        const timesteps = timestepData.timesteps;
        const startIndex = currentFrameIndex || 0;
        const limit = maxFramesToPreload || timesteps.length;
        const endIndex = Math.min(startIndex + limit, timesteps.length);

        const targetTimesteps = timesteps.slice(startIndex, endIndex);
        const total = targetTimesteps.length;

        if (!total || signal?.aborted) {
            return {};
        }

        let loadedCount = 0;

        const promises = targetTimesteps.map(async (timestep: number) => {
            if (signal?.aborted) {
                return;
            }

            const assetParams = {
                teamId,
                trajectoryId,
                currentTimestep: timestep,
                analysisId,
                activeScene: activeScene as SceneObjectType
            };

            try {
                if (signal?.aborted) {
                    return;
                }

                await preloadFractalSceneAsset(assetParams, { signal });
            } catch {
            } finally {
                if (signal?.aborted) {
                    return;
                }

                loadedCount++;
                if (onProgress) {
                    onProgress(loadedCount / total, { bps: 0 });
                }
            }
        });

        await Promise.all(promises);
        return {};
    },

    resetTimesteps() {
        set(createInitialState());
    }
});
