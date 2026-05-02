import type { ModelWorldBounds, ModelLoadingState } from '@/modules/fractal/api/entities/model';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';

export type { SceneObjectType };

export enum PointCloudDetailLevel {
    Auto = 'auto',
    Performance = 'performance',
    Balanced = 'balanced',
    Quality = 'quality'
}

export enum PointCloudStyleMode {
    Flat = 'flat',
    Softened = 'softened'
}

export interface PointCloudSettingsState {
    overridesEnabled: boolean;
    detailLevel: PointCloudDetailLevel;
    useSceneOpacity: boolean;
    style: PointCloudStyleMode;
}

interface TrajectoryGLBs {
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

export interface ModelDragOffset {
    x: number;
    y: number;
    z: number;
}

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
    // Drag offset per scene key — each model has its own translation, so
    // moving one leaves the others untouched.
    modelDragOffsets: Record<string, ModelDragOffset>;
    showSimulationCell: boolean;
    isPointCloudScene: boolean;
}

interface ModelActions {
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
    setModelDragOffsetForScene: (sceneKey: string, offset: ModelDragOffset) => void;
    getModelDragOffsetForScene: (sceneKey: string) => ModelDragOffset;
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
    rangeStart?: number;
    rangeEnd?: number;
    // Why: frame-rate budget used to compute playback cadence. Driven from
    // dataset metadata (LAMMPS dump frequency → FPS) so each trajectory plays
    // at its native rhythm.
    targetFps: number;
}

interface PlaybackActions {
    togglePlay: (params: PlaybackTimelineParams) => void;
    setPlaySpeed: (speed: number) => void;
    setTargetFps: (fps: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    stopPlayback: () => void;
    resetPlayback: () => void;
    setRangeStart: (value: number | undefined) => void;
    setRangeEnd: (value: number | undefined) => void;
    /**
     * Advances the playback clock using the high-resolution reading supplied by
     * R3F `useFrame`. Called from the Canvas subtree — not by a module-local
     * rAF loop. Reuses the single rAF already scheduled by the renderer.
     */
    tick: (now: number) => void;
}

export type PlaybackStore = PlaybackState & PlaybackActions;
type TimelineGLBMap = Record<number, string>;

export interface PlaybackTimelineParams {
    trajectoryId?: string;
    timesteps: number[];
}

interface TimestepActions {
    loadModels: (params: LoadTimelineModelsParams) => Promise<TimelineGLBMap>;
}

interface LoadTimelineModelsParams {
    trajectoryId: string;
    timesteps: number[];
    onProgress?: (p: number, m?: { bps: number }) => void;
    maxFramesToPreload?: number;
    currentFrameIndex?: number;
    signal?: AbortSignal;
}

export type TimestepStore = TimestepActions;
