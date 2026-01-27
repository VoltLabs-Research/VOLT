import type { StateCreator } from 'zustand';
import type { ModelStore, ModelState, ModelActions } from '@/types/stores/editor/model';
import { SceneSettingsService } from '@/modules/canvas/domain/services/SceneSettingsService';

const sceneSettingsService = new SceneSettingsService();

const initialState: ModelState = {
    activeModel: null,
    activeScene: { sceneType: 'trajectory', source: 'default' } as any,
    activeScenes: [{ sceneType: 'trajectory', source: 'default' } as any],
    isModelLoading: false,
    pointSizeMultiplier: 1.0,
    sceneOpacities: {}
};

export const createModelSlice: StateCreator<any, [], [], ModelStore> = (set, get) => ({
    ...initialState,

    setActiveScene(scene) {
        set({
            activeScene: scene,
            activeScenes: [scene]
        });
    },

    addScene(scene) {
        set((state: ModelState) => {
            const nextScenes = sceneSettingsService.addScene(state.activeScenes as any, scene as any);
            if (nextScenes === state.activeScenes) return state;
            return { activeScenes: nextScenes };
        });
    },

    removeScene(scene) {
        set((state: ModelState) => ({
            activeScenes: sceneSettingsService.removeScene(state.activeScenes as any, scene as any)
        }));
    },

    toggleScene(scene) {
        const state = get();
        const nextScenes = sceneSettingsService.toggleScene(state.activeScenes as any, scene as any);
        if (nextScenes === state.activeScenes) return;
        set({ activeScenes: nextScenes });
    },

    setModelBounds(modelBounds) {
        const { activeModel } = get();
        if (!activeModel) return;

        set({
            activeModel: { ...activeModel, modelBounds }
        });
    },

    setIsModelLoading(loading) {
        set({ isModelLoading: loading });
    },

    selectModel(glbs) {
        set({ activeModel: { glbs } });
    },

    setGlbsWithoutLoading(glbs) {
        set({ activeModel: { glbs } });
    },

    resetModel() {
        set({
            activeModel: null,
            isModelLoading: false,
            activeScenes: [{ sceneType: 'trajectory', source: 'default' } as any],
            activeScene: { sceneType: 'trajectory', source: 'default' } as any,
            pointSizeMultiplier: 1.0
        });
    },

    setPointSizeMultiplier(multiplier) {
        set({ pointSizeMultiplier: sceneSettingsService.clampPointSize(multiplier) });
    },

    increasePointSize() {
        set((state: ModelState) => ({
            pointSizeMultiplier: sceneSettingsService.adjustPointSize(state.pointSizeMultiplier, 0.1)
        }));
    },

    decreasePointSize() {
        set((state: ModelState) => ({
            pointSizeMultiplier: sceneSettingsService.adjustPointSize(state.pointSizeMultiplier, -0.1)
        }));
    },

    setSceneOpacity(sceneKey: string, opacity: number) {
        set((state: ModelState) => ({
            sceneOpacities: {
                ...state.sceneOpacities,
                [sceneKey]: sceneSettingsService.clampOpacity(opacity)
            }
        }));
    },

    getSceneOpacity(sceneKey: string): number {
        return get().sceneOpacities[sceneKey] ?? 1.0;
    }
});
