export enum PerformancePreset {
    Ultra = 'ultra',
    High = 'high',
    Balanced = 'balanced',
    Performance = 'performance',
    Battery = 'battery'
};

export enum PowerPreference {
    Default = 'default',
    HighPerformance = 'high-performance',
    LowPower = 'low-power'
};

export interface DprSettings {
    mode: 'fixed' | 'adaptive';
    fixed: number;
    min: number;
    max: number;
    pixelated: boolean;
    snap: boolean;
    interactionMin: number;
};

export interface CanvasPerformanceProp {
    current: number;
    min: number;
    max: number;
    debounce: number;
};

export interface CanvasSettings {
    powerPreference: PowerPreference;
};

export interface AdaptiveEventsSettings {
    enabled: boolean;
};

export interface InteractionDegradeSettings {
    enabled: boolean;
    debounceMs: number;
};

export interface PerformanceSettingsState {
    preset: PerformancePreset;
    dpr: DprSettings;
    canvas: CanvasSettings;
    performance: CanvasPerformanceProp;
    adaptiveEvents: AdaptiveEventsSettings;
    interactionDegrade: InteractionDegradeSettings;
};

export interface PerformanceSettingsActions {
    setPreset: (preset: PerformancePreset) => void;
    setDpr: (partial: Partial<DprSettings>) => void;
    setCanvas: (partial: Partial<CanvasSettings>) => void;
    setPerformance: (partial: Partial<CanvasPerformanceProp>) => void;
    setAdaptiveEvents: (partial: Partial<AdaptiveEventsSettings>) => void;
    setInteractionDegrade: (partial: Partial<InteractionDegradeSettings>) => void;
    reset: () => void;

    selectCanvasDpr: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => number | [number, number];
    selectCanvasProps: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => {
        dpr: number | [number, number];
        performance: CanvasPerformanceProp;
    };
    selectAdaptiveDprProps: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => {
        enabled: boolean;
        pixelated: boolean;
    };
};

export type PerformanceSettingsStore = PerformanceSettingsState & PerformanceSettingsActions;

export enum ToneMappingMode {
    None = 'None',
    Linear = 'Linear',
    Reinhard = 'Reinhard',
    Cineon = 'Cineon',
    ACESFilmic = 'ACESFilmic',
    AgX = 'AgX',
    Neutral = 'Neutral'
};

export enum OutputCS {
    SRGB = 'SRGB',
    LinearSRGB = 'LinearSRGB',
    DisplayP3 = 'DisplayP3',
    LinearDisplayP3 = 'LinearDisplayP3'
};

export enum ShadowType {
    Basic = 'Basic',
    PCF = 'PCF',
    PCFSoft = 'PCFSoft',
    VSM = 'VSM'
};

export enum PrecisionType {
    High = 'highp',
    Medium = 'mediump',
    Low = 'lowp'
};

export type RendererCreateState = {
    antialias: boolean;
    alpha: boolean;
    depth: boolean;
    stencil: boolean;
    logarithmicDepthBuffer: boolean;
    preserveDrawingBuffer: boolean;
    premultipliedAlpha: boolean;
    failIfMajorPerformanceCaveat: boolean;
    precision: PrecisionType;
};

export type RendererRuntimeState = {
    toneMapping: ToneMappingMode;
    toneMappingExposure: number;
    outputColorSpace: OutputCS;

    shadowEnabled: boolean;
    shadowType: ShadowType;
    shadowAutoUpdate: boolean;

    localClippingEnabled: boolean;
    sortObjects: boolean;

    autoClear: boolean;
    autoClearColor: boolean;
    autoClearDepth: boolean;
    autoClearStencil: boolean;
};

export type RendererSettingsState = {
    create: RendererCreateState;
    runtime: RendererRuntimeState;
};

export type RendererSettingsActions = {
    setCreate: (partial: Partial<RendererCreateState>) => void;
    setRuntime: (partial: Partial<RendererRuntimeState>) => void;
    resetCreate: () => void;
    resetRuntime: () => void;
    reset: () => void;
};

export type RendererSettingsStore = RendererSettingsState & RendererSettingsActions;

export const ORBIT_CONTROLS_DEFAULT_CONFIG = {
    enableDamping: true,
    dampingFactor: 0.05,
    rotateSpeed: 1.0,
    zoomSpeed: 1.2,
    panSpeed: 0.8,
    minDistance: 1,
    maxDistance: 100,
    enabled: true,
};

export const SSAO_DEFAULT_CONFIG = {
    enabled: false,
    samples: 32,
    radius: 0.5,
    intensity: 1.0,
    bias: 0.01,
    kernelRadius: 8,
    minDistance: 0.001,
    maxDistance: 0.1,
    worldDistanceThreshold: 0.5,
    worldDistanceFalloff: 0.3,
    worldProximityThreshold: 0.5,
    worldProximityFalloff: 0.3
};

export const GL_DEFAULT_CONFIG = {
    antialias: true,
    alpha: true,
    powerPreference: PowerPreference.HighPerformance,
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    preserveDrawingBuffer: false,
};

export interface RenderConfigState {
    gl: typeof GL_DEFAULT_CONFIG;
    orbitControls: typeof ORBIT_CONTROLS_DEFAULT_CONFIG;
    SSAO: typeof SSAO_DEFAULT_CONFIG;
};

export interface RenderConfigActions {
    reset: () => void;
};

export type RenderConfigStore = RenderConfigState & RenderConfigActions;
