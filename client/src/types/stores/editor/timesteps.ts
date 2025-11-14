import type { Trajectory } from '@/types/models';
import type { TimelineGLBMap } from '@/utilities/glb/modelUtils';

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
    loadModels: (preloadBehavior?: boolean) => Promise<TimelineGLBMap>;
    reset: () => void;
}

export type TimestepStore = TimestepState & TimestepActions;
