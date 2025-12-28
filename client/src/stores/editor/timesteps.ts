import { create } from 'zustand';
import type { Trajectory } from '@/types/models';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useTrajectoryStore from '@/stores/trajectories';

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

    async computeTimestepData(trajectory: Trajectory | null, currentTimestep?: number, cacheBuster?: number) {
        if(!trajectory?.frames || trajectory.frames.length === 0){
            set({ timestepData: initialTimestepData });
            return;
        }

        // Extract timesteps directly
        const timesteps = extractTimestepsWorker(trajectory.frames);
        const timestepData = createTimestepData(timesteps);

        set({ timestepData });
    },

    reset: () => set(initialState)
}));

export default useTimestepStore;
