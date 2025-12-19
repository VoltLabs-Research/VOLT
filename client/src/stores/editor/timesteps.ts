import { create } from 'zustand';
import type { Trajectory } from '@/types/models';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useTrajectoryStore from '@/stores/trajectories';
import { fetchModels, type TimelineGLBMap } from '@/utilities/glb/modelUtils';

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
    if(!frames || frames.length === 0) return [];
    return frames
        .map((frame: any) => frame.timestep)
        .sort((a: number, b: number) => a - b);
};

const createTimestepData = (timesteps: number[]): TimestepData => ({
    timesteps,
    minTimestep: timesteps[0] || 0,
    maxTimestep: timesteps[timesteps.length - 1] || 0,
    timestepCount: timesteps.length,
});

const useTimestepStore = create<TimestepStore>()((set, get) => ({
    ...initialState,

    async loadModels(
        preloadBehavior?: boolean,
        onProgress?: (p: number, m?: { bps: number }) => void,
        maxFramesToPreload?: number,
        currentFrameIndex?: number
    ): Promise<TimelineGLBMap> {
        const trajectory = useTrajectoryStore.getState().trajectory;
        const analysis = useAnalysisConfigStore.getState().analysisConfig;
        const { timesteps } = get().timestepData;

        if(!trajectory?._id) throw new Error('No trajectory loaded');
        if(timesteps.length === 0) throw new Error('No timesteps available in trajectory');

        const analysisId = analysis?._id || 'default';

        const map = await fetchModels({
            trajectoryId: trajectory._id,
            analysisId,
            timesteps,
            preloadBehavior,
            concurrency: 6,
            onProgress,
            maxFramesToPreload,
            currentFrameIndex
        });

        return map;
    },

    async computeTimestepData(trajectory: Trajectory | null, currentTimestep?: number, cacheBuster?: number) {
        if(!trajectory?.frames || trajectory.frames.length === 0){
            set({ timestepData: initialTimestepData });
            return;
        }

        // Extract timesteps directly
        const timesteps = extractTimestepsWorker(trajectory.frames);
        const timestepData = createTimestepData(timesteps);

        // NOTE: We no longer call selectModel() here!
        // The GLB URL is now computed locally in TimestepViewer component.
        // This prevents race conditions when navigating between trajectories.

        set({ timestepData });
    },

    reset: () => set(initialState)
}));

export default useTimestepStore;
