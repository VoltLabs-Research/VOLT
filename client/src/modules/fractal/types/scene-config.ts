import type {
    CameraSettingsState,
    OrbitControlsState,
    CanvasGridSettingsState,
    EnvironmentConfigState,
    EffectsConfigState,
    LightsState
} from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { PowerPreference } from '@/shared/domain/rendering/performance';
import type {
    RendererCreateState,
    RendererRuntimeState,
    RenderConfigState,
    DprSettings,
    CanvasPerformanceProp
} from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { PointCloudSettingsState } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { SlicePlaneConfig, SceneObjectType } from '@/modules/fractal/api/entities/scene';

export interface PointCloudSceneSettings extends PointCloudSettingsState {
    pointSizeMultiplier: number;
};

export interface FractalSceneConfig {
    rendererCreate: RendererCreateState & { powerPreference: PowerPreference };
    rendererRuntime: RendererRuntimeState;
    camera: CameraSettingsState;
    orbitControls: OrbitControlsState;
    grid: CanvasGridSettingsState;
    environment: EnvironmentConfigState;
    effects: EffectsConfigState;
    lights: LightsState;
    renderConfig: RenderConfigState;
    pointCloudSettings: PointCloudSceneSettings;
    slicePlaneConfig: SlicePlaneConfig;
    dpr: DprSettings;
    performance: CanvasPerformanceProp;
    adaptiveEventsEnabled: boolean;
    interactionDegradeEnabled: boolean;
    activeScene: SceneObjectType;
};
