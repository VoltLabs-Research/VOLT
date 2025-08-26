import type { Trajectory } from '@/types/models';

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
    computeTimestepData: (trajectory: Trajectory | null, currentTimestep?: number) => void;
    reset: () => void;
}

export type TimestepStore = TimestepState & TimestepActions;
