import type {
    CameraSettingsState,
    CanvasGridSettingsState,
    EffectsConfigState,
    EnvironmentConfigState,
    LightsState,
    OrbitControlsState
} from '@/modules/fractal/stores/contracts/editor/visual-types';
import type {
    CanvasPerformanceProp,
    DprSettings,
    RendererCreateState,
    RendererRuntimeState
} from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { PointCloudSettingsState } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { SlicePlaneConfig, SceneObjectType } from '@/modules/fractal/api/entities/scene';

export interface PointCloudSceneSettings extends PointCloudSettingsState {
    pointSizeMultiplier: number;
}

export interface DislocationLineSceneSettings {
    baseLineWidth: number;
    lineWidth: number;
}

export interface FractalSceneConfig {
    rendererCreate: RendererCreateState;
    rendererRuntime: RendererRuntimeState;
    camera: CameraSettingsState;
    orbitControls: OrbitControlsState;
    grid: CanvasGridSettingsState;
    environment: EnvironmentConfigState;
    effects: EffectsConfigState;
    lights: LightsState;
    pointCloudSettings: PointCloudSceneSettings;
    slicePlaneConfig: SlicePlaneConfig;
    dpr: DprSettings;
    performance: CanvasPerformanceProp;
    adaptiveEventsEnabled: boolean;
    interactionDegradeEnabled: boolean;
    activeScene: SceneObjectType;
}
