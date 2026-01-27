import type { SliceCreator } from '@/shared/presentation/stores/helpers';

export interface TimestepData {
    timesteps: number[];
    minTimestep: number;
    maxTimestep: number;
    timestepCount: number;
}

export interface TimestepState {
    timestepData: TimestepData;
    isRenderOptionsLoading: boolean;
}

export interface TimestepActions {
    computeTimestepData: (trajectory: any | null) => void;
    resetTimesteps: () => void;
}

export type TimestepSlice = TimestepState & TimestepActions;

const initialTimestepData: TimestepData = {
    timesteps: [],
    minTimestep: 0,
    maxTimestep: 0,
    timestepCount: 0
};

export const initialState: TimestepState = {
    timestepData: initialTimestepData,
    isRenderOptionsLoading: false
};

export const createTimestepSlice: SliceCreator<TimestepSlice> = (set, get) => ({
    ...initialState,

    computeTimestepData: (trajectory) => {
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            set({ timestepData: initialTimestepData });
            return;
        }

        const timesteps = Array.from(new Set<number>(trajectory.frames.map((frame: any) => frame.timestep)))
            .sort((a, b) => a - b);
        
        const timestepData: TimestepData = {
            timesteps,
            minTimestep: timesteps[0] || 0,
            maxTimestep: timesteps[timesteps.length - 1] || 0,
            timestepCount: timesteps.length,
        };

        set({ timestepData });
    },

    resetTimesteps: () => {
        set(initialState);
    }
});
