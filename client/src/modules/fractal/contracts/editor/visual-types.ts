import type {
    CameraSettings,
    OrbitControlsSettings
} from '@/shared/rendering/camera';
import type { EffectsSettings } from '@/shared/rendering/effects';
import type { EnvironmentSettings, FogSettings } from '@/shared/rendering/environment';

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

interface CanvasGridSettingsActions {
    setGrid: (partial: Partial<CanvasGridSettingsState>) => void;
    reset: () => void;
}

interface EnvironmentConfigActions {
    setBackgroundColor: (color: string) => void;
    setFogConfig: (config: Partial<FogConfig>) => void;
    reset: () => void;
}

interface CameraSettingsActions {
    setPosition: (position: CameraSettingsState['position']) => void;
    setUp: (up: CameraSettingsState['up']) => void;
    reset: () => void;
}

export type CameraSettingsState = CameraSettings;
export type CameraSettingsStore = CameraSettingsState & CameraSettingsActions;
export type OrbitControlsState = OrbitControlsSettings;
export type OrbitControlsStore = OrbitControlsState & OrbitControlsActions;
export type CanvasGridSettingsStore = CanvasGridSettingsState & CanvasGridSettingsActions;
export type FogConfig = FogSettings;
export type EnvironmentConfigState = EnvironmentSettings;
export type EnvironmentConfigStore = EnvironmentConfigState & EnvironmentConfigActions;
export type EffectsConfigState = EffectsSettings;

interface OrbitControlsActions {
    setTarget: (t: [number, number, number]) => void;
    reset: () => void;
}
