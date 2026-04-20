import type { ModelWorldBounds, ModelLoadingState } from '@/modules/fractal/api/entities/model';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';

export type { SceneObjectType };

export enum PointCloudDetailLevel {
    Auto = 'auto',
    Performance = 'performance',
    Balanced = 'balanced',
    Quality = 'quality'
};

export enum PointCloudStyleMode {
    Flat = 'flat',
    Softened = 'softened'
};

export interface PointCloudSettingsState {
    overridesEnabled: boolean;
    detailLevel: PointCloudDetailLevel;
    useSceneOpacity: boolean;
    style: PointCloudStyleMode;
};

export interface TrajectoryGLBs {
    trajectory: string;
    defect_mesh: string;
    interface_mesh: string;
    dislocations: string;
    core_atoms: string;
    atoms_colored_by_type: string;
};

export interface ModelData {
    modelBounds?: BoundsInfo | null;
    glbs: TrajectoryGLBs | null;
};

export interface ModelDragOffset {
    x: number;
    y: number;
    z: number;
};

export interface ModelState {
    activeScene: SceneObjectType;
    activeScenes: SceneObjectType[];
    activeModel: ModelData | null;
    isModelLoading: boolean;
    modelLoadProgress: number;
    modelLoadError: string | null;
    pointSizeMultiplier: number;
    pointCloudSettings: PointCloudSettingsState;
    sceneVisualOverrides: SceneVisualOverrides;
    modelWorldBounds: ModelWorldBounds | null;
    modelDragOffset: ModelDragOffset;
    showSimulationCell: boolean;
    isPointCloudScene: boolean;
};

export interface ModelActions {
    selectModel: (glbs: TrajectoryGLBs | null) => void;
    setGlbsWithoutLoading: (glbs: TrajectoryGLBs | null) => void;
    resetModel: () => void;
    setIsModelLoading: (loading: boolean) => void;
    setModelLoadingState: (state: ModelLoadingState) => void;
    setModelBounds: (modelBounds: BoundsInfo | null) => void;
    setModelWorldBounds: (bounds: ModelWorldBounds | null) => void;
    setActiveScene: (scene: SceneObjectType) => void;
    clearTimestepScopedScenes: () => void;
    addScene: (scene: SceneObjectType) => void;
    removeScene: (scene: SceneObjectType) => void;
    toggleScene: (scene: SceneObjectType) => void;
    setPointSizeMultiplier: (multiplier: number) => void;
    increasePointSize: () => void;
    decreasePointSize: () => void;
    setPointCloudSettings: (partial: Partial<PointCloudSettingsState>) => void;
    resetPointCloudSettings: () => void;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    getSceneOpacity: (sceneKey: string) => number;
    setSceneLineWidth: (sceneKey: string, lineWidth: number) => void;
    getSceneLineWidth: (sceneKey: string) => number | undefined;
    setShowSimulationCell: (show: boolean) => void;
    setIsPointCloudScene: (isPointCloud: boolean) => void;
    setModelDragOffset: (offset: ModelDragOffset) => void;
};

export type ModelStore = ModelActions & ModelState;

export interface PlaybackState {
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    isPreloading?: boolean;
    didPreload?: boolean;
    preloadProgress?: number;
    downlinkMbps?: number | null;
    rangeStart?: number;
    rangeEnd?: number;
};

export interface PlaybackActions {
    togglePlay: (params: PlaybackTimelineParams) => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    stopPlayback: () => void;
    resetPlayback: () => void;
    setRangeStart: (value: number | undefined) => void;
    setRangeEnd: (value: number | undefined) => void;
};

export type PlaybackStore = PlaybackState & PlaybackActions;
export type TimelineGLBMap = Record<number, string>;

export interface PlaybackTimelineParams {
    trajectoryId?: string;
    timesteps: number[];
};

export interface TimestepActions {
    loadModels: (params: LoadTimelineModelsParams) => Promise<TimelineGLBMap>;
};

export interface LoadTimelineModelsParams {
    trajectoryId: string;
    timesteps: number[];
    onProgress?: (p: number, m?: { bps: number }) => void;
    maxFramesToPreload?: number;
    currentFrameIndex?: number;
    signal?: AbortSignal;
};

export type TimestepStore = TimestepActions;
