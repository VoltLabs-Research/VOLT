import { isSameScene } from '@/modules/canvas/utilities/scene-identity';

import type { EditorStore } from './types';
import type { ModelLoadingState } from '@/modules/fractal/types';
import type { ModelWorldBounds } from '@/modules/fractal/types/configuration';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/stores/contracts/editor/scene-types';

import type {
    ModelStore,
    ModelState,
    PointCloudSettingsState,
    SceneObjectType,
    ModelData
} from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { StateCreator } from 'zustand';

const POINT_CLOUD_SETTINGS_INITIAL: PointCloudSettingsState = {
    overridesEnabled: false,
    detailLevel: PointCloudDetailLevel.Auto,
    useSceneOpacity: true,
    style: PointCloudStyleMode.Softened
};

const createInitialState = (): ModelState => ({
    activeModel: null,
    activeScene: { sceneType: 'trajectory', source: 'default' },
    activeScenes: [{ sceneType: 'trajectory', source: 'default' }],
    isModelLoading: false,
    modelLoadProgress: 0,
    modelLoadError: null,
    pointSizeMultiplier: 1.0,
    pointCloudSettings: POINT_CLOUD_SETTINGS_INITIAL,
    sceneOpacities: {},
    modelWorldBounds: null
});

export const createModelSlice: StateCreator<EditorStore, [], [], ModelStore> = (set, get) => ({
    ...createInitialState(),

    setActiveScene(scene: SceneObjectType) {
        set({
            activeScene: scene,
            activeScenes: [scene]
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
        set((state) => ({
            activeScenes: state.activeScenes.filter(s => !isSameScene(s, scene))
        }));
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
        set({ modelWorldBounds: bounds });
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
        set((state) => ({
            sceneOpacities: {
                ...state.sceneOpacities,
                [sceneKey]: Math.max(0, Math.min(1, opacity))
            }
        }));
    },

    getSceneOpacity(sceneKey: string): number {
        return get().sceneOpacities[sceneKey] ?? 1.0;
    }
});
