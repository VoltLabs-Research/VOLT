import { useEditorStore } from '@/modules/canvas/store/editor';

import type { EditorStore } from '@/modules/canvas/store/editor/types';

/** Store fields shared verbatim between collaborators. */
type SharedValueKey =
    | 'activeScene'
    | 'activeScenes'
    | 'activeModel'
    | 'sceneVisualOverrides'
    | 'showSimulationCell'
    | 'pointSizeMultiplier'
    | 'pointCloudSettings'
    | 'isPointCloudScene'
    | 'currentTimestep'
    | 'isPlaying'
    | 'playSpeed'
    | 'rangeStart'
    | 'rangeEnd'
    | 'modelDragOffsets';

/** Store slices shared as a data-only subset, merged onto the local slice. */
type SharedSliceKey =
    | 'lights'
    | 'effects'
    | 'grid'
    | 'environment'
    | 'rendererSettings'
    | 'performanceSettings'
    | 'configuration';

export type SharedCanvasState =
    Partial<Pick<EditorStore, SharedValueKey>>
    & { [Key in SharedSliceKey]?: Partial<EditorStore[Key]> };

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
const CONFIGURATION_DATA_KEYS = ['activeSidebarOption', 'activeModifier'] as const;

/** Copies the data fields of a slice, leaving its action functions behind. */
const pickDataFields = <Slice extends object, Key extends keyof Slice>(
    source: Slice,
    keys: readonly Key[]
): Pick<Slice, Key> => {
    const output = {} as Pick<Slice, Key>;

    for (const key of keys) {
        output[key] = source[key];
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
    return stripNonSerializable<SharedCanvasState>({
        activeScene: state.activeScene,
        activeScenes: state.activeScenes,
        activeModel: state.activeModel,
        sceneVisualOverrides: state.sceneVisualOverrides,
        showSimulationCell: state.showSimulationCell,
        pointSizeMultiplier: state.pointSizeMultiplier,
        pointCloudSettings: state.pointCloudSettings,
        isPointCloudScene: state.isPointCloudScene,
        currentTimestep: state.currentTimestep,
        isPlaying: state.isPlaying,
        playSpeed: state.playSpeed,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd,
        modelDragOffsets: state.modelDragOffsets,
        lights: pickDataFields(state.lights, LIGHTS_DATA_KEYS),
        effects: pickDataFields(state.effects, EFFECTS_DATA_KEYS),
        grid: pickDataFields(state.grid, GRID_DATA_KEYS),
        environment: pickDataFields(state.environment, ENVIRONMENT_DATA_KEYS),
        rendererSettings: pickDataFields(state.rendererSettings, RENDERER_DATA_KEYS),
        performanceSettings: pickDataFields(state.performanceSettings, PERFORMANCE_DATA_KEYS),
        configuration: pickDataFields(state.configuration, CONFIGURATION_DATA_KEYS)
    });
};

/**
 * Shared values land on the store as sent; shared slices are merged so the
 * action functions and any unshared fields of the local slice survive.
 */
export const applySharedCanvasPatch = (patch: SharedCanvasState): void => {
    useEditorStore.setState((state) => {
        const {
            lights,
            effects,
            grid,
            environment,
            rendererSettings,
            performanceSettings,
            configuration,
            ...values
        } = patch;

        return {
            ...values,
            ...(lights && { lights: { ...state.lights, ...lights } }),
            ...(effects && { effects: { ...state.effects, ...effects } }),
            ...(grid && { grid: { ...state.grid, ...grid } }),
            ...(environment && { environment: { ...state.environment, ...environment } }),
            ...(rendererSettings && { rendererSettings: { ...state.rendererSettings, ...rendererSettings } }),
            ...(performanceSettings && { performanceSettings: { ...state.performanceSettings, ...performanceSettings } }),
            ...(configuration && { configuration: { ...state.configuration, ...configuration } })
        };
    });
};
