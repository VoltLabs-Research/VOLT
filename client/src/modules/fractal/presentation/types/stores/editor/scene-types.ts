import type { Trajectory } from '@/modules/trajectory/domain/entities';
import type { ModelWorldBounds } from '@/modules/fractal/presentation/types/configuration';

// =============================================================================
// Model Types
// =============================================================================
interface TrajectoryGLBs {
    trajectory: string;
    defect_mesh: string;
    interface_mesh: string;
    dislocations: string;
    core_atoms: string;
    atoms_colored_by_type: string;
}

export type DefaultScene = {
    sceneType: string;
    source: 'default';
};

export type PluginScene = {
    sceneType: string;
    source: 'plugin';
    analysisId: string;
    exposureId: string;
};

export type ColorCodingScene = {
    sceneType: string;
    source: 'color-coding';
    analysisId?: string;
    exposureId: string;
    property: string;
    startValue: string;
    endValue: string;
    gradient: string;
};

export type ParticleFilterScene = {
    sceneType: 'particle-filter';
    source: 'particle-filter';
    analysisId?: string;
    exposureId?: string;
    property: string;
    operator: string;
    value: number;
    action?: string;
};

export type SceneObjectType = DefaultScene | PluginScene | ColorCodingScene | ParticleFilterScene;

export interface ModelData {
    modelBounds?: null,
    glbs: null
}

export type ActiveScene = SceneObjectType;

export interface ModelState {
    activeScene: SceneObjectType;
    activeScenes: ActiveScene[];
    activeModel: ModelData | null;
    isModelLoading: boolean;
    pointSizeMultiplier: number;
    sceneOpacities: Record<string, number>;
    modelWorldBounds: ModelWorldBounds | null;
}

export interface ModelActions {
    selectModel: (glbs: any) => void;
    setGlbsWithoutLoading: (glbs: any) => void;
    resetModel: () => void;
    setIsModelLoading: (loading: boolean) => void;
    setModelBounds: (modelBounds: any) => void;
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

// =============================================================================
// Playback Types
// =============================================================================
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

// =============================================================================
// Timesteps Types
// =============================================================================
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
        currentFrameIndex?: number
    ) => Promise<TimelineGLBMap>;
    resetTimesteps: () => void;
};

export type TimestepStore = TimestepState & TimestepActions;
