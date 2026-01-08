import type { StateCreator } from 'zustand';
import type { Trajectory } from '@/types/models';
import type { TimestepData, TimestepState, TimestepStore } from '@/types/stores/editor/timesteps';

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

// Pure function for worker - extracts and sorts timesteps
const extractTimestepsWorker = (frames: any[]): number[] => {
    if (!frames || frames.length === 0) return [];
    return Array.from(new Set(frames.map((frame: any) => frame.timestep)))
        .sort((a: number, b: number) => a - b);
};

const createTimestepData = (timesteps: number[]): TimestepData => ({
    timesteps,
    minTimestep: timesteps[0] || 0,
    maxTimestep: timesteps[timesteps.length - 1] || 0,
    timestepCount: timesteps.length,
});

export const createTimestepSlice: StateCreator<any, [], [], TimestepStore> = (set, get) => ({
    ...initialState,

    async computeTimestepData(trajectory: Trajectory | null, currentTimestep?: number, cacheBuster?: number) {
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            set({ timestepData: initialTimestepData });
            return;
        }

        // Extract timesteps directly
        const timesteps = extractTimestepsWorker(trajectory.frames);
        const timestepData = createTimestepData(timesteps);

        set({ timestepData });
    },

    loadModels: async (preloadBehavior, onProgress, maxFramesToPreload, currentFrameIndex) => {
        const { timestepData } = get();
        if (!timestepData.timesteps.length) return {};

        const state = get(); // Access other slices if merged, but safer to use global stores if independent

        const { useTeamStore } = await import('@/features/team/stores');
        const { useTrajectoryStore } = await import('@/features/trajectory/stores');
        const { loadGLB } = await import('@/features/canvas/utilities/loader');
        const { computeGlbUrl } = await import('@/features/canvas/utilities/scene-utils');
        // TODO:
        const { useEditorStore } = await import('@/features/canvas/stores/editor');

        const teamId = useTeamStore.getState().selectedTeam?._id;
        const trajectoryId = useTrajectoryStore.getState().trajectory?._id;
        // Also check EditorStore for active scene config to support analysis/plugins
        const editorState = useEditorStore.getState();
        const activeScene = editorState.activeScene;
        const analysisId = editorState.model?.analysisId || 'default'; // Or from ActiveScene

        if (!teamId || !trajectoryId) return {};

        const timesteps = timestepData.timesteps;
        const startIndex = currentFrameIndex || 0;
        const limit = maxFramesToPreload || timesteps.length;
        const endIndex = Math.min(startIndex + limit, timesteps.length);

        const targetTimesteps = timesteps.slice(startIndex, endIndex);
        const total = targetTimesteps.length;
        let loadedCount = 0;

        const results: Record<number, any> = {};

        const promises = targetTimesteps.map(async (timestep, i) => {
            const url = computeGlbUrl(teamId, trajectoryId, timestep, analysisId, activeScene);
            if (!url) return;

            try {
                // loadGLB is cached now, so re-calls are cheap
                await loadGLB(url);
            } catch (e) {
                console.error(`Failed to preload frame ${timestep}`, e);
            } finally {
                loadedCount++;
                if (onProgress) {
                    onProgress(loadedCount / total, { bps: 0 }); // Todo: calculate BPS
                }
            }
        });

        await Promise.all(promises);
        return results;
    },

    resetTimesteps() {
        set(initialState);
    }
});
