import type { Trajectory } from '@/modules/trajectory/domain/entities';
import type { TimelineGLBMap } from '@/modules/canvas/presentation/utilities/modelUtils';

export interface TimestepData {
    timesteps: number[];
    minTimestep: number;
    maxTimestep: number;
    timestepCount: number;
};

export interface TimestepState {
    timestepData: TimestepData;
    isRenderOptionsLoading: boolean;
};

export interface TimestepActions {
    computeTimestepData: (trajectory: Trajectory | null, currentTimestep?: number, cacheBuster?: number) => void;
    loadModels: (
        preloadBehavior?: boolean,
        onProgress?: (p: number, m?: { bps: number }) => void,
        maxFramesToPreload?: number,
        currentFrameIndex?: number
    ) => Promise<TimelineGLBMap>;
    resetTimesteps: () => void;
};

export type TimestepStore = TimestepState & TimestepActions;
