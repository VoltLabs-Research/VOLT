export type CameraType = 'perspective' | 'orthographic';

export interface PerspectiveSettings {
    fov: number;
    near: number;
    far: number;
    zoom: number;
    focus: number;
    filmGauge: number;
    filmOffset: number;
    aspect: number;
    enableAutoFocus: boolean;
    autoFocusSpeed: number;
    bokehScale: number;
    maxBlur: number;
};

export interface OrthographicSettings {
    near: number;
    far: number;
    zoom: number;
};

export interface CameraSettingsState {
    type: CameraType;
    position: [number, number, number];
    up: [number, number, number];
    perspective: PerspectiveSettings;
    orthographic: OrthographicSettings;
};

export interface CameraSettingsActions {
    setType: (type: CameraType) => void;
    setPosition: (position: [number, number, number]) => void;
    setUp: (up: [number, number, number]) => void;
    setPerspective: (partial: Partial<PerspectiveSettings>) => void;
    setOrthographic: (partial: Partial<OrthographicSettings>) => void;
    setCamera: (partial: Partial<CameraSettingsState> & {
        perspective?: Partial<PerspectiveSettings>;
        orthographic?: Partial<OrthographicSettings>;
    }) => void;
    reset: () => void;
}

export type CameraSettingsStore = CameraSettingsState & CameraSettingsActions;

export const PERSPECTIVE_DEFAULT: PerspectiveSettings = {
    fov: 50,
    near: 0.01,
    far: 200,
    zoom: 1,
    filmGauge: 35,
    filmOffset: 0,
    focus: 5,
    aspect: 1,
    enableAutoFocus: false,
    autoFocusSpeed: 0.1,
    bokehScale: 1,
    maxBlur: 0.01
};

export const ORTHOGRAPHIC_DEFAULT: OrthographicSettings = {
    near: 0.1,
    far: 1000,
    zoom: 1
};

export interface CanvasGridSettingsState {
    enabled: boolean;
    infiniteGrid: boolean;
    cellSize: number;
    sectionSize: number;
    cellThickness: number;
    sectionThickness: number;
    fadeDistance: number;
    fadeStrength: number;
    sectionColor: string;
    cellColor: string;
    position: [number, number, number];
    rotation: [number, number, number];
};

export interface CanvasGridSettingsActions {
    setGrid: (partial: Partial<CanvasGridSettingsState>) => void;
    reset: () => void;
};

export type CanvasGridSettingsStore = CanvasGridSettingsState & CanvasGridSettingsActions;

export interface DirLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
    shadowBias: number;
    shadowNormalBias: number;
    camLeft: number;
    camRight: number;
    camTop: number;
    camBottom: number;
    camNear: number;
    camFar: number;
    helper: boolean;
};

export interface PointLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    distance: number;
    decay: number;
    castShadow: boolean;
    helper: boolean;
};

export interface SpotLight {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
    target: [number, number, number];
    distance: number;
    angle: number;
    penumbra: number;
    decay: number;
    castShadow: boolean;
    helper: boolean;
};

export interface HemiLight {
    enabled: boolean;
    skyColor: string;
    groundColor: string;
    intensity: number;
    position: [number, number, number];
    helper: boolean;
};

export interface RectAreaLightCfg {
    enabled: boolean;
    color: string;
    intensity: number;
    width: number;
    height: number;
    position: [number, number, number];
    lookAt: [number, number, number];
    helper: boolean;
};

export interface LightsGlobal {
    envIntensity: number;
    envRotationYaw: number;
    envRotationPitch: number;
    envBlur: number;
};

export interface LightsState {
    global: LightsGlobal;
    directional: DirLight;
    point: PointLight;
    spot: SpotLight;
    hemisphere: HemiLight;
    rectArea: RectAreaLightCfg;
};

export interface LightsActions {
    setGlobal: (g: Partial<LightsGlobal>) => void;
    setDirectional: (d: Partial<DirLight>) => void;
    setPoint: (p: Partial<PointLight>) => void;
    setSpot: (s: Partial<SpotLight>) => void;
    setHemisphere: (h: Partial<HemiLight>) => void;
    setRectArea: (r: Partial<RectAreaLightCfg>) => void;
    reset: () => void;
}

export type LightsStore = LightsState & LightsActions;

export interface FogConfig {
    enableFog: boolean;
    fogColor: string;
    fogNear: number;
    fogFar: number;
};

export interface EnvironmentConfigState extends FogConfig {
    backgroundColor: string;
    backgroundType: 'color' | 'environment';
    environmentPreset: string;
    toneMappingExposure: number;
};

export interface EnvironmentConfigActions {
    setBackgroundColor: (color: string) => void;
    setBackgroundType: (type: 'color' | 'environment') => void;
    setEnvironmentPreset: (preset: string) => void;
    setFogConfig: (config: Partial<FogConfig>) => void;
    setToneMappingExposure: (exposure: number) => void;
    reset: () => void;
};

export type EnvironmentConfigStore = EnvironmentConfigState & EnvironmentConfigActions;

export const ENVIRONMENT_DEFAULT_CONFIG: EnvironmentConfigState = {
    backgroundColor: '#0a0a0a',
    backgroundType: 'color',
    environmentPreset: 'studio',
    enableFog: false,
    fogColor: '#ffffff',
    fogNear: 1,
    fogFar: 100,
    toneMappingExposure: 5
};

export const CHROMATIC_ABERRATION_DEFAULT = {
    enabled: false,
    offset: [0.005, 0.005] as [number, number],
    blendFunction: 0
};

export const DEPTH_OF_FIELD_DEFAULT = {
    enabled: false,
    focusDistance: 0,
    focalLength: 0.02,
    bokehScale: 2,
    blendFunction: 0,
    height: 480
};

export const BLOOM_EFFECT_DEFAULT = {
    enabled: false,
    intensity: 1.0,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025,
    kernelSize: 3,
    blendFunction: 0
};

export const NOISE_DEFAULT = {
    enabled: false,
    opacity: 0.1,
    blendFunction: 0,
    premultiply: false
};

export const VIGNETTE_DEFAULT = {
    enabled: false,
    darkness: 0.5,
    offset: 0.5,
    blendFunction: 0,
    eskil: false
};

export const SEPIA_DEFAULT = {
    enabled: false,
    intensity: 1.0,
    blendFunction: 0
};

export const SSAO_EFFECT_DEFAULT = {
    enabled: false,
    samples: 16,
    radius: 0.5,
    intensity: 1.0,
    blendFunction: 0,
    luminanceInfluence: 0.7,
    worldDistanceThreshold: 0.5,
    worldDistanceFalloff: 0.1,
    worldProximityThreshold: 0.5,
    worldProximityFalloff: 0.1
};

export interface EffectsConfigState {
    ssao: typeof SSAO_EFFECT_DEFAULT;
    bloom: typeof BLOOM_EFFECT_DEFAULT;
    chromaticAberration: typeof CHROMATIC_ABERRATION_DEFAULT;
    vignette: typeof VIGNETTE_DEFAULT;
    depthOfField: typeof DEPTH_OF_FIELD_DEFAULT;
    noise: typeof NOISE_DEFAULT;
    sepia: typeof SEPIA_DEFAULT;
};

export interface EffectsConfigActions {
    setSSAOEffect: (config: Partial<typeof SSAO_EFFECT_DEFAULT>) => void;
    setBloomEffect: (config: Partial<typeof BLOOM_EFFECT_DEFAULT>) => void;
    setChromaticAberration: (config: Partial<typeof CHROMATIC_ABERRATION_DEFAULT>) => void;
    setVignette: (config: Partial<typeof VIGNETTE_DEFAULT>) => void;
    setDepthOfField: (config: Partial<typeof DEPTH_OF_FIELD_DEFAULT>) => void;
    setNoise: (config: Partial<typeof NOISE_DEFAULT>) => void;
    setSepia: (config: Partial<typeof SEPIA_DEFAULT>) => void;
    reset: () => void;
};

export type EffectsConfigStore = EffectsConfigState & EffectsConfigActions;

export type OrbitControlsState = {
    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    target: [number, number, number];
};

export type OrbitControlsActions = {
    set: (partial: Partial<OrbitControlsState>) => void;
    setTarget: (t: [number, number, number]) => void;
    reset: () => void;
};

export type OrbitControlsStore = OrbitControlsState & OrbitControlsActions;
