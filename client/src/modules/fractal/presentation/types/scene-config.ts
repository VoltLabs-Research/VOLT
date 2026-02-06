import type {
    CameraSettingsState,
    OrbitControlsState,
    CanvasGridSettingsState,
    EnvironmentConfigState,
    EffectsConfigState,
    LightsState
} from '@/modules/fractal/presentation/types/stores/editor/visual-types';
import type {
    RendererCreateState,
    RendererRuntimeState,
    RenderConfigState,
    DprSettings,
    CanvasPerformanceProp,
    PowerPreference
} from '@/modules/fractal/presentation/types/stores/editor/performance-types';
import type { SlicePlaneConfig } from '@/modules/fractal/presentation/types/configuration';

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
    activeScene: any;
}
