import { useEditorStore } from '@/modules/canvas/stores/editor';

import type { EditorStore } from '@/modules/canvas/stores/editor/types';

type Plain = Record<string, unknown>;

export interface SharedCanvasState {
    activeScene?: unknown;
    activeScenes?: unknown[];
    activeModel?: unknown;
    sceneVisualOverrides?: Plain;
    showSimulationCell?: boolean;
    pointSizeMultiplier?: number;
    pointCloudSettings?: Plain;
    isPointCloudScene?: boolean;
    currentTimestep?: number;
    isPlaying?: boolean;
    playSpeed?: number;
    rangeStart?: number;
    rangeEnd?: number;
    camera?: Plain;
    orbitControls?: Plain;
    lights?: Plain;
    effects?: Plain;
    grid?: Plain;
    environment?: Plain;
    rendererSettings?: Plain;
    performanceSettings?: Plain;
    configuration?: Plain;
}

const CAMERA_DATA_KEYS = ['type', 'position', 'up', 'perspective', 'orthographic'] as const;

const ORBIT_CONTROLS_DATA_KEYS = [
    'enabled',
    'enableDamping',
    'dampingFactor',
    'enableZoom',
    'zoomSpeed',
    'enableRotate',
    'rotateSpeed',
    'enablePan',
    'panSpeed',
    'screenSpacePanning',
    'autoRotate',
    'autoRotateSpeed',
    'minDistance',
    'maxDistance',
    'minPolarAngle',
    'maxPolarAngle',
    'minAzimuthAngle',
    'maxAzimuthAngle',
    'target'
] as const;

const LIGHTS_DATA_KEYS = ['global', 'directional', 'point', 'spot', 'hemisphere', 'rectArea'] as const;

const EFFECTS_DATA_KEYS = [
    'ssao',
    'bloom',
    'chromaticAberration',
    'vignette',
    'depthOfField',
    'noise',
    'sepia'
] as const;

const GRID_DATA_KEYS = [
    'enabled',
    'infiniteGrid',
    'cellSize',
    'sectionSize',
    'cellThickness',
    'sectionThickness',
    'fadeDistance',
    'fadeStrength',
    'sectionColor',
    'sectionColorFollowsTheme',
    'cellColor',
    'cellColorFollowsTheme',
    'position',
    'rotation'
] as const;

const ENVIRONMENT_DATA_KEYS = [
    'backgroundColor',
    'backgroundColorFollowsTheme',
    'enableFog',
    'fogColor',
    'fogColorFollowsTheme',
    'fogNear',
    'fogFar'
] as const;

const RENDERER_DATA_KEYS = ['create', 'runtime'] as const;
const PERFORMANCE_DATA_KEYS = ['preset', 'dpr', 'performance', 'adaptiveEvents', 'interactionDegrade'] as const;
const CONFIGURATION_DATA_KEYS = ['slicePlaneConfig', 'activeSidebarOption', 'activeModifier'] as const;

const pickDataFields = <TSource, TKey extends string>(
    source: TSource | undefined,
    keys: readonly TKey[]
): Plain | undefined => {
    if (!source || typeof source !== 'object') {
        return undefined;
    }

    const record = source as Record<string, unknown>;
    const output: Plain = {};

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            output[key] = record[key];
        }
    }

    return output;
};

const stripNonSerializable = <T>(value: T): T => {
    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch {
        return value;
    }
};

export const selectSharedCanvasState = (state: EditorStore): SharedCanvasState => {
    const payload: SharedCanvasState = {
        activeScene: state.activeScene,
        activeScenes: state.activeScenes,
        activeModel: state.activeModel,
        sceneVisualOverrides: state.sceneVisualOverrides as Plain,
        showSimulationCell: state.showSimulationCell,
        pointSizeMultiplier: state.pointSizeMultiplier,
        pointCloudSettings: state.pointCloudSettings as unknown as Plain,
        isPointCloudScene: state.isPointCloudScene,
        currentTimestep: state.currentTimestep,
        isPlaying: state.isPlaying,
        playSpeed: state.playSpeed,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd,
        camera: pickDataFields(state.camera, CAMERA_DATA_KEYS),
        orbitControls: pickDataFields(state.orbitControls, ORBIT_CONTROLS_DATA_KEYS),
        lights: pickDataFields(state.lights, LIGHTS_DATA_KEYS),
        effects: pickDataFields(state.effects, EFFECTS_DATA_KEYS),
        grid: pickDataFields(state.grid, GRID_DATA_KEYS),
        environment: pickDataFields(state.environment, ENVIRONMENT_DATA_KEYS),
        rendererSettings: pickDataFields(state.rendererSettings, RENDERER_DATA_KEYS),
        performanceSettings: pickDataFields(state.performanceSettings, PERFORMANCE_DATA_KEYS),
        configuration: pickDataFields(state.configuration, CONFIGURATION_DATA_KEYS)
    };

    return stripNonSerializable(payload);
};

export const diffSharedCanvasState = (
    base: SharedCanvasState | null,
    next: SharedCanvasState
): SharedCanvasState => {
    if (!base) {
        return { ...next };
    }

    const delta: Plain = {};
    const nextRecord = next as Plain;
    const baseRecord = base as Plain;

    for (const key of Object.keys(nextRecord)) {
        if (!areEqual(baseRecord[key], nextRecord[key])) {
            delta[key] = nextRecord[key];
        }
    }

    return delta as SharedCanvasState;
};

export const applySharedCanvasPatch = (patch: SharedCanvasState): void => {
    const store = useEditorStore;

    store.setState((state) => {
        const next: Partial<EditorStore> = {};
        const record = state as unknown as Record<string, unknown>;

        if (patch.activeScene !== undefined) {
            next.activeScene = patch.activeScene as EditorStore['activeScene'];
        }

        if (patch.activeScenes !== undefined) {
            next.activeScenes = patch.activeScenes as EditorStore['activeScenes'];
        }

        if (patch.activeModel !== undefined) {
            next.activeModel = patch.activeModel as EditorStore['activeModel'];
        }

        if (patch.sceneVisualOverrides !== undefined) {
            next.sceneVisualOverrides = patch.sceneVisualOverrides as EditorStore['sceneVisualOverrides'];
        }

        if (typeof patch.showSimulationCell === 'boolean') {
            next.showSimulationCell = patch.showSimulationCell;
        }

        if (typeof patch.pointSizeMultiplier === 'number') {
            next.pointSizeMultiplier = patch.pointSizeMultiplier;
        }

        if (patch.pointCloudSettings !== undefined) {
            next.pointCloudSettings = patch.pointCloudSettings as unknown as EditorStore['pointCloudSettings'];
        }

        if (typeof patch.isPointCloudScene === 'boolean') {
            next.isPointCloudScene = patch.isPointCloudScene;
        }

        if (patch.currentTimestep !== undefined) {
            next.currentTimestep = patch.currentTimestep;
        }

        if (typeof patch.isPlaying === 'boolean') {
            next.isPlaying = patch.isPlaying;
        }

        if (typeof patch.playSpeed === 'number') {
            next.playSpeed = patch.playSpeed;
        }

        if (patch.rangeStart !== undefined) {
            next.rangeStart = patch.rangeStart;
        }

        if (patch.rangeEnd !== undefined) {
            next.rangeEnd = patch.rangeEnd;
        }

        mergeSlice(next, state, 'camera', patch.camera, record);
        mergeSlice(next, state, 'orbitControls', patch.orbitControls, record);
        mergeSlice(next, state, 'lights', patch.lights, record);
        mergeSlice(next, state, 'effects', patch.effects, record);
        mergeSlice(next, state, 'grid', patch.grid, record);
        mergeSlice(next, state, 'environment', patch.environment, record);
        mergeSlice(next, state, 'rendererSettings', patch.rendererSettings, record);
        mergeSlice(next, state, 'performanceSettings', patch.performanceSettings, record);
        mergeSlice(next, state, 'configuration', patch.configuration, record);

        return next;
    });
};

const mergeSlice = (
    next: Partial<EditorStore>,
    state: EditorStore,
    key: keyof EditorStore,
    patchSlice: Plain | undefined,
    record: Record<string, unknown>
): void => {
    if (!patchSlice) {
        return;
    }

    const currentSlice = record[key as string];
    if (!currentSlice || typeof currentSlice !== 'object') {
        return;
    }

    const merged = { ...(currentSlice as Plain), ...patchSlice } as unknown;
    (next as Record<string, unknown>)[key as string] = merged;

    void state;
};

const areEqual = (left: unknown, right: unknown): boolean => {
    if (left === right) {
        return true;
    }

    try {
        return JSON.stringify(left) === JSON.stringify(right);
    } catch {
        return false;
    }
};
