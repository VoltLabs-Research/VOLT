import type { Trajectory } from '@/types/models';
import type { TimelineGLBMap } from '@/features/canvas/utilities/modelUtils';

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
    computeTimestepData: (trajectory: Trajectory | null, currentTimestep?: number, cacheBuster?: number) => void;
    loadModels: (
        preloadBehavior?: boolean,
        onProgress?: (p: number, m?: { bps: number }) => void,
        maxFramesToPreload?: number,
        currentFrameIndex?: number
    ) => Promise<TimelineGLBMap>;
    resetTimesteps: () => void;
}

export type TimestepStore = TimestepState & TimestepActions;
