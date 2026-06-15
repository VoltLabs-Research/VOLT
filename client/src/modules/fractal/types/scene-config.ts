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

// Bond rendering settings for a bonds exposure. A bonds GLB is a line-tube
// cylinder mesh (daemon BondExporter delegates to the line exporter), so width
// is expressed as LineSceneSettings; these fields carry the bond-specific inputs
// the fractal bond primitive (BondsModelViewer) maps to that, plus the count
// used for scale-aware render gating (see bond-render.ts).
export interface BondSceneSettings {
    // Per-bond cylinder radius the exposure was baked with (Å).
    radius?: number;
    // User width override (Å) — applied in-frame via the engine's line-width path.
    widthOverride?: number;
    // Total bond count, for the scale-aware render gate (geometry budget cap).
    count?: number;
}

// Triangle ranges per line entity, read from the GLB's `.ranges.json` sidecar.
// Maps a listing row's entity id to the index-buffer slice of its tube.
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

// Screen-space lasso path, in CSS pixels relative to the scene canvas. `closed`
// flags that the polygon's last point joins back to the first for the
// point-in-polygon test.
export interface SelectionLasso {
    points: Array<[x: number, y: number]>;
    closed: boolean;
}

// Screen-space axis-aligned box, in CSS pixels relative to the scene canvas.
export interface SelectionBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

// Result of a GPU color-ID pick. `atomIndex` is the position in the fetched
// atoms array (original, pre-morton order) — callers map it to the frame-stable
// `id` column to drive selection. A line pick reports the entity + hit triangle
// instead, reusing the existing ranges-sidecar resolution.
export type AtomPickEvent = {
    type: 'atom';
    atomIndex: number;
    screenX: number;
    screenY: number;
} | {
    type: 'line';
    entityId: number;
    faceIndex: number;
    screenX: number;
    screenY: number;
};

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
