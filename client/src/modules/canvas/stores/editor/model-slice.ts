import { isSameScene, isTimestepScopedScene } from '@/modules/canvas/utilities/scene-identity';
import { DEFAULT_SCENE, getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { areModelWorldBoundsEqual } from '@/modules/fractal/utilities/model-world-bounds';

import type { EditorStore } from './types';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/model';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/stores/contracts/editor/scene-types';

import type { ModelStore, ModelState, PointCloudSettingsState, ModelData, ModelDragOffset } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { StateCreator } from 'zustand';

const POINT_CLOUD_SETTINGS_INITIAL: PointCloudSettingsState = {
    overridesEnabled: false,
    detailLevel: PointCloudDetailLevel.Auto,
    useSceneOpacity: true,
    style: PointCloudStyleMode.Softened
};

const areSceneListsEqual = (left: SceneObjectType[], right: SceneObjectType[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((scene, index) => isSameScene(scene, right[index]));
};

const getSceneStateWithoutTimestepScopedScenes = (state: ModelState): Pick<ModelState, 'activeScene' | 'activeScenes'> | null => {
    const activeScenes = state.activeScenes.filter((scene) => !isTimestepScopedScene(scene));
    const nextActiveScenes = activeScenes.length > 0 ? activeScenes : [DEFAULT_SCENE];
    const nextActiveScene = isTimestepScopedScene(state.activeScene)
        ? nextActiveScenes[0]
        : state.activeScene;

    const didChangeActiveScene = !isSameScene(state.activeScene, nextActiveScene);
    const didChangeActiveScenes = !areSceneListsEqual(state.activeScenes, nextActiveScenes);

    if (!didChangeActiveScene && !didChangeActiveScenes) {
        return null;
    }

    return {
        activeScene: nextActiveScene,
        activeScenes: nextActiveScenes
    };
};

const MODEL_DRAG_OFFSET_ZERO: ModelDragOffset = { x: 0, y: 0, z: 0 };

const createInitialState = (): ModelState => ({
    activeModel: null,
    activeScene: DEFAULT_SCENE,
    activeScenes: [DEFAULT_SCENE],
    isModelLoading: false,
    modelLoadProgress: 0,
    modelLoadError: null,
    pointSizeMultiplier: 1.0,
    pointCloudSettings: POINT_CLOUD_SETTINGS_INITIAL,
    sceneVisualOverrides: {},
    modelWorldBounds: null,
    modelDragOffsets: {},
    showSimulationCell: true,
    isPointCloudScene: false
});

export const createModelSlice: StateCreator<EditorStore, [], [], ModelStore> = (set, get) => ({
    ...createInitialState(),

    setActiveScene(scene: SceneObjectType) {
        set({
            activeScene: scene,
            activeScenes: [scene]
        });
    },

    clearTimestepScopedScenes() {
        set((state) => {
            return getSceneStateWithoutTimestepScopedScenes(state) ?? state;
        });
    },

    addScene(scene: SceneObjectType) {
        set((state) => {
            const exists = state.activeScenes.some(s => isSameScene(s, scene));
            if (exists) return state;
            return { activeScenes: [...state.activeScenes, scene] };
        });
    },

    removeScene(scene: SceneObjectType) {
        set((state) => {
            const removedKey = getSceneKey(scene);
            const nextOffsets = { ...state.modelDragOffsets };
            delete nextOffsets[removedKey];

            return {
                activeScenes: state.activeScenes.filter(s => !isSameScene(s, scene)),
                modelDragOffsets: nextOffsets
            };
        });
    },

    toggleScene(scene: SceneObjectType) {
        const state = get();
        const exists = state.activeScenes.some((s: SceneObjectType) => isSameScene(s, scene));

        if (exists) {
            get().removeScene(scene);
        } else {
            get().addScene(scene);
        }
    },

    setModelBounds(modelBounds: ModelData['modelBounds']) {
        const { activeModel } = get();
        if (!activeModel) return;

        set({
            activeModel: { ...activeModel, modelBounds }
        });
    },

    setModelWorldBounds(bounds: ModelWorldBounds | null) {
        set((state) => {
            if (areModelWorldBoundsEqual(state.modelWorldBounds, bounds)) {
                return state;
            }

            return { modelWorldBounds: bounds };
        });
    },

    setIsModelLoading(loading: boolean) {
        set({ isModelLoading: loading, modelLoadProgress: loading ? 0 : get().modelLoadProgress });
    },

    setModelLoadingState(loadingState: ModelLoadingState) {
        set({
            isModelLoading: loadingState.isLoading,
            modelLoadProgress: loadingState.progress,
            modelLoadError: loadingState.error
        });
    },

    selectModel(glbs: ModelData['glbs']) {
        set({ activeModel: { glbs } });
    },

    setGlbsWithoutLoading(glbs: ModelData['glbs']) {
        set({ activeModel: { glbs } });
    },

    resetModel() {
        set(createInitialState());
    },

    setPointSizeMultiplier(multiplier: number) {
        set({ pointSizeMultiplier: Math.max(0.1, Math.min(5.0, multiplier)) });
    },

    increasePointSize() {
        set((state) => ({
            pointSizeMultiplier: Math.min(5.0, state.pointSizeMultiplier + 0.1)
        }));
    },

    decreasePointSize() {
        set((state) => ({
            pointSizeMultiplier: Math.max(0.1, state.pointSizeMultiplier - 0.1)
        }));
    },

    setPointCloudSettings(partial: Partial<PointCloudSettingsState>) {
        set((state) => ({
            pointCloudSettings: {
                ...state.pointCloudSettings,
                ...partial
            }
        }));
    },

    resetPointCloudSettings() {
        set({ pointCloudSettings: POINT_CLOUD_SETTINGS_INITIAL });
    },

    setSceneOpacity(sceneKey: string, opacity: number) {
        const nextOpacity = Math.max(0, Math.min(1, opacity));

        set((state) => ({
            sceneVisualOverrides: {
                ...state.sceneVisualOverrides,
                [sceneKey]: {
                    ...state.sceneVisualOverrides[sceneKey],
                    opacity: nextOpacity
                }
            }
        }));
    },

    getSceneOpacity(sceneKey: string): number {
        return get().sceneVisualOverrides[sceneKey]?.opacity ?? 1.0;
    },

    setSceneLineWidth(sceneKey: string, lineWidth: number) {
        const nextLineWidth = Number.isFinite(lineWidth)
            ? Math.max(0.01, lineWidth)
            : 0.01;

        set((state) => ({
            sceneVisualOverrides: {
                ...state.sceneVisualOverrides,
                [sceneKey]: {
                    ...state.sceneVisualOverrides[sceneKey],
                    lineWidth: nextLineWidth
                }
            }
        }));
    },

    getSceneLineWidth(sceneKey: string): number | undefined {
        return get().sceneVisualOverrides[sceneKey]?.lineWidth;
    },

    setShowSimulationCell(show: boolean) {
        set({ showSimulationCell: show });
    },

    setIsPointCloudScene(isPointCloud: boolean) {
        set((state) => {
            if (state.isPointCloudScene === isPointCloud) return state;
            return { isPointCloudScene: isPointCloud };
        });
    },

    setModelDragOffsetForScene(sceneKey: string, offset: ModelDragOffset) {
        set((state) => {
            const current = state.modelDragOffsets[sceneKey];
            if (current && current.x === offset.x && current.y === offset.y && current.z === offset.z) {
                return state;
            }

            return {
                modelDragOffsets: {
                    ...state.modelDragOffsets,
                    [sceneKey]: offset
                }
            };
        });
    },

    getModelDragOffsetForScene(sceneKey: string): ModelDragOffset {
        return get().modelDragOffsets[sceneKey] ?? MODEL_DRAG_OFFSET_ZERO;
    }
});
