import type {
    CameraSettings,
    OrthographicCameraSettings,
    OrbitControlsSettings,
    PerspectiveCameraSettings
} from '@/shared/domain/rendering/camera';
import type {
    BloomSettings,
    ChromaticAberrationSettings,
    DepthOfFieldSettings,
    EffectsSettings,
    NoiseSettings,
    SceneSsaoConfig,
    SSAOEffectSettings,
    SepiaSettings,
    UserSsaoConfig,
    VignetteSettings
} from '@/shared/domain/rendering/effects';
import type { EnvironmentSettings, FogSettings } from '@/shared/domain/rendering/environment';

export {
    CameraType,
    CAMERA_TYPE_OPTIONS,
    CAMERA_SUBSECTION_TITLES,
    CAMERA_DEFAULTS,
    ORBIT_CONTROLS_DEFAULT_SETTINGS,
    ORTHOGRAPHIC_DEFAULTS as ORTHOGRAPHIC_DEFAULT,
    PERSPECTIVE_DEFAULTS as PERSPECTIVE_DEFAULT,
    getDefaultCameraSettings,
    getDefaultOrbitControlsSettings,
    isCameraType
} from '@/shared/domain/rendering/camera';
export {
    BLOOM_EFFECT_DEFAULTS as BLOOM_EFFECT_DEFAULT,
    CHROMATIC_ABERRATION_DEFAULTS as CHROMATIC_ABERRATION_DEFAULT,
    DEPTH_OF_FIELD_DEFAULTS as DEPTH_OF_FIELD_DEFAULT,
    EFFECT_SECTION_ORDER,
    EFFECT_SECTION_TITLES,
    EffectSectionId,
    NOISE_EFFECT_DEFAULTS as NOISE_DEFAULT,
    SCENE_SSAO_DEFAULT,
    SEPIA_EFFECT_DEFAULTS as SEPIA_DEFAULT,
    SSAO_EFFECT_DEFAULTS as SSAO_EFFECT_DEFAULT,
    USER_SSAO_DEFAULT,
    resolveSSAOSettings,
    VIGNETTE_EFFECT_DEFAULTS as VIGNETTE_DEFAULT,
    getDefaultEffectsSettings
} from '@/shared/domain/rendering/effects';
export {
    ENVIRONMENT_DEFAULT_SETTINGS as ENVIRONMENT_DEFAULT_CONFIG,
    ENVIRONMENT_SUBSECTION_TITLES,
    getDefaultEnvironmentSettings
} from '@/shared/domain/rendering/environment';
export {
    LightingPreset,
    LIGHTS_DEFAULT_STATE,
    getDefaultLightsState
} from '@/shared/domain/rendering/lights';
export type {
    DirLight,
    HemiLight,
    LightsActions,
    LightsGlobal,
    LightsState,
    LightsStore,
    PointLight,
    RectAreaLightCfg,
    SpotLight
} from '@/shared/domain/rendering/lights';

export interface CameraUpdateState {
    type?: CameraSettingsState['type'];
    position?: CameraSettingsState['position'];
    up?: CameraSettingsState['up'];
    perspective?: Partial<PerspectiveSettings>;
    orthographic?: Partial<OrthographicSettings>;
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

export interface EnvironmentConfigActions {
    setBackgroundColor: (color: string) => void;
    setFogConfig: (config: Partial<FogConfig>) => void;
    reset: () => void;
};

export interface CameraSettingsActions {
    setType: (type: CameraSettingsState['type']) => void;
    setPosition: (position: CameraSettingsState['position']) => void;
    setUp: (up: CameraSettingsState['up']) => void;
    setPerspective: (partial: Partial<PerspectiveSettings>) => void;
    setOrthographic: (partial: Partial<OrthographicSettings>) => void;
    setCamera: (partial: CameraUpdateState) => void;
    reset: () => void;
};

export interface EffectsConfigActions {
    setSSAOEffect: (config: Partial<SSAOEffectConfig>) => void;
    setBloomEffect: (config: Partial<BloomEffectConfig>) => void;
    setChromaticAberration: (config: Partial<ChromaticAberrationConfig>) => void;
    setVignette: (config: Partial<VignetteEffectConfig>) => void;
    setDepthOfField: (config: Partial<DepthOfFieldConfig>) => void;
    setNoise: (config: Partial<NoiseEffectConfig>) => void;
    setSepia: (config: Partial<SepiaEffectConfig>) => void;
    reset: () => void;
};

export type PerspectiveSettings = PerspectiveCameraSettings;
export type OrthographicSettings = OrthographicCameraSettings;
export type CameraSettingsState = CameraSettings;
export type CameraSettingsStore = CameraSettingsState & CameraSettingsActions;
export type OrbitControlsState = OrbitControlsSettings;
export type OrbitControlsStore = OrbitControlsState & OrbitControlsActions;
export type CanvasGridSettingsStore = CanvasGridSettingsState & CanvasGridSettingsActions;
export type FogConfig = FogSettings;
export type EnvironmentConfigState = EnvironmentSettings;
export type EnvironmentConfigStore = EnvironmentConfigState & EnvironmentConfigActions;
export type SSAOEffectConfig = SSAOEffectSettings;
export type { SceneSsaoConfig, UserSsaoConfig };
export type BloomEffectConfig = BloomSettings;
export type ChromaticAberrationConfig = ChromaticAberrationSettings;
export type VignetteEffectConfig = VignetteSettings;
export type DepthOfFieldConfig = DepthOfFieldSettings;
export type NoiseEffectConfig = NoiseSettings;
export type SepiaEffectConfig = SepiaSettings;
export type EffectsConfigState = EffectsSettings;
export type EffectsConfigStore = EffectsConfigState & EffectsConfigActions;

export interface OrbitControlsActions {
    set: (partial: Partial<OrbitControlsState>) => void;
    setTarget: (t: [number, number, number]) => void;
    reset: () => void;
};
