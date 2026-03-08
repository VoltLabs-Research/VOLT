import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/fractal';
import type { BoundsInfo } from '@/modules/fractal/core/model-transform';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/fractal';
import type { SceneObjectType } from '@/modules/fractal/api/entities/fractal';

export type { SceneObjectType };

export interface TrajectoryGLBs {
    trajectory: string;
    defect_mesh: string;
    interface_mesh: string;
    dislocations: string;
    core_atoms: string;
    atoms_colored_by_type: string;
}

export interface ModelData {
    modelBounds?: BoundsInfo | null;
    glbs: TrajectoryGLBs | null;
}

export interface ModelState {
    activeScene: SceneObjectType;
    activeScenes: SceneObjectType[];
    activeModel: ModelData | null;
    isModelLoading: boolean;
    modelLoadProgress: number;
    modelLoadError: string | null;
    pointSizeMultiplier: number;
    sceneOpacities: Record<string, number>;
    modelWorldBounds: ModelWorldBounds | null;
}

export interface ModelActions {
    selectModel: (glbs: TrajectoryGLBs | null) => void;
    setGlbsWithoutLoading: (glbs: TrajectoryGLBs | null) => void;
    resetModel: () => void;
    setIsModelLoading: (loading: boolean) => void;
    setModelLoadingState: (state: ModelLoadingState) => void;
    setModelBounds: (modelBounds: BoundsInfo | null) => void;
    setModelWorldBounds: (bounds: ModelWorldBounds | null) => void;
    setActiveScene: (scene: SceneObjectType) => void;
    addScene: (scene: SceneObjectType) => void;
    removeScene: (scene: SceneObjectType) => void;
    toggleScene: (scene: SceneObjectType) => void;
    setPointSizeMultiplier: (multiplier: number) => void;
    increasePointSize: () => void;
    decreasePointSize: () => void;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    getSceneOpacity: (sceneKey: string) => number;
}

export type ModelStore = ModelActions & ModelState;

export interface PlaybackState {
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    isPreloading?: boolean;
    didPreload?: boolean;
    preloadProgress?: number;
    downlinkMbps?: number | null;
};

export interface PlaybackActions {
    togglePlay: () => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    playNextFrame: () => void;
    stopPlayback: () => void;
    resetPlayback: () => void;
};

export type PlaybackStore = PlaybackState & PlaybackActions;
export type TimelineGLBMap = Record<number, string>;

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
        currentFrameIndex?: number,
        signal?: AbortSignal
    ) => Promise<TimelineGLBMap>;
    resetTimesteps: () => void;
};

export type TimestepStore = TimestepState & TimestepActions;
