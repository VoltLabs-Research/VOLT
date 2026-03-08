import type {
    CameraSettingsState,
    OrbitControlsState,
    CanvasGridSettingsState,
    EnvironmentConfigState,
    EffectsConfigState,
    LightsState
} from '@/modules/fractal/stores/contracts/editor/visual-types';
import type {
    RendererCreateState,
    RendererRuntimeState,
    RenderConfigState,
    DprSettings,
    CanvasPerformanceProp,
    PowerPreference
} from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { SlicePlaneConfig, SceneObjectType } from '@/modules/fractal/api/entities/scene';

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
    slicePlaneConfig: SlicePlaneConfig;
    dpr: DprSettings;
    performance: CanvasPerformanceProp;
    adaptiveEventsEnabled: boolean;
    interactionDegradeEnabled: boolean;
    activeScene: SceneObjectType;
};
