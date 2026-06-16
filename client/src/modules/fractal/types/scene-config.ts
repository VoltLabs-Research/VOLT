import type { CameraSettingsState, CanvasGridSettingsState, EffectsConfigState, EnvironmentConfigState, OrbitControlsState } from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { LightsState } from '@/shared/domain/rendering/lights';
import type { CanvasPerformanceProp, DprSettings } from '@/shared/domain/rendering/performance';
import type { RendererCreateState, RendererRuntimeState } from '@/shared/domain/rendering/renderer';
import type { PointCloudSettingsState } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';

export interface PointCloudSceneSettings extends PointCloudSettingsState {
    pointSizeMultiplier: number;
}

export interface LineSceneSettings {
    baseLineWidth: number;
    lineWidth: number;
}

export interface BondSceneSettings {
    radius?: number;
    widthOverride?: number;
    count?: number;
}

export interface LineEntityRange {
    id: number;
    triangleStart: number;
    triangleCount: number;
}

export interface LineEntityHighlight {
    sceneKey: string;
    entityId: number;
    entityRanges: LineEntityRange[];
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
    dpr: DprSettings;
    performance: CanvasPerformanceProp;
    adaptiveEventsEnabled: boolean;
    interactionDegradeEnabled: boolean;
    activeScene: SceneObjectType;
}
