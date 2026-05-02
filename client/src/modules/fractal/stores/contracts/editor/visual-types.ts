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
    SSAOEffectSettings,
    SepiaSettings,
    VignetteSettings
} from '@/shared/domain/rendering/effects';
import type { EnvironmentSettings, FogSettings } from '@/shared/domain/rendering/environment';
import type { LightsState } from '@/shared/domain/rendering/lights';

export type { LightsState };

export interface CameraUpdateState {
    type?: CameraSettingsState['type'];
    position?: CameraSettingsState['position'];
    up?: CameraSettingsState['up'];
    perspective?: Partial<PerspectiveSettings>;
    orthographic?: Partial<OrthographicSettings>;
}

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
    sectionColorFollowsTheme: boolean;
    cellColor: string;
    cellColorFollowsTheme: boolean;
    position: [number, number, number];
    rotation: [number, number, number];
}

export interface CanvasGridSettingsActions {
    setGrid: (partial: Partial<CanvasGridSettingsState>) => void;
    reset: () => void;
}

export interface EnvironmentConfigActions {
    setBackgroundColor: (color: string) => void;
    setFogConfig: (config: Partial<FogConfig>) => void;
    reset: () => void;
}

export interface CameraSettingsActions {
    setType: (type: CameraSettingsState['type']) => void;
    setPosition: (position: CameraSettingsState['position']) => void;
    setUp: (up: CameraSettingsState['up']) => void;
    setPerspective: (partial: Partial<PerspectiveSettings>) => void;
    setOrthographic: (partial: Partial<OrthographicSettings>) => void;
    setCamera: (partial: CameraUpdateState) => void;
    reset: () => void;
}

export interface EffectsConfigActions {
    setSSAOEffect: (config: Partial<SSAOEffectConfig>) => void;
    setBloomEffect: (config: Partial<BloomEffectConfig>) => void;
    setChromaticAberration: (config: Partial<ChromaticAberrationConfig>) => void;
    setVignette: (config: Partial<VignetteEffectConfig>) => void;
    setDepthOfField: (config: Partial<DepthOfFieldConfig>) => void;
    setNoise: (config: Partial<NoiseEffectConfig>) => void;
    setSepia: (config: Partial<SepiaEffectConfig>) => void;
    reset: () => void;
}

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
}
