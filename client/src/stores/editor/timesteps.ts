import { create } from 'zustand';
import type { Trajectory } from '@/types/models';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useModelStore from '@/stores/editor/model';
import useTrajectoryStore from '@/stores/trajectories';
import { createTrajectoryGLBs, fetchModels, type TimelineGLBMap } from '@/utilities/glb/modelUtils';
import { runInWorkerWithFallback } from '@/utilities/worker-utils';
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

        if (!trajectory?._id) throw new Error('No trajectory loaded');
        if (timesteps.length === 0) throw new Error('No timesteps available in trajectory');

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
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            set({ timestepData: initialTimestepData });
            return;
        }

        // Extract timesteps in worker for large trajectories
        const timesteps = await runInWorkerWithFallback(extractTimestepsWorker, trajectory.frames);
        const timestepData = createTimestepData(timesteps);

        // Only load GLB if trajectory processing is completed
        if (trajectory._id && currentTimestep !== undefined && timesteps.length > 0 && trajectory.status === 'completed') {
            const currentAnalysis = useAnalysisConfigStore.getState().analysisConfig;
            const analysisId = currentAnalysis?._id || '';
            const finalAnalysisId = analysisId || 'default';

            const glbs = createTrajectoryGLBs(
                trajectory._id,
                currentTimestep,
                finalAnalysisId,
                cacheBuster
            );

            useModelStore.getState().selectModel(glbs);
        }

        set({ timestepData });
    },

    reset: () => set(initialState)
}));

export default useTimestepStore;
