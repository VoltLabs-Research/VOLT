import type { StateCreator } from 'zustand';
import type { ModelStore, ModelState, ModelActions } from '@/types/stores/editor/model';

const initialState: ModelState = {
    activeModel: null,
    activeScene: { sceneType: 'trajectory', source: 'default' } as any,
    activeScenes: [{ sceneType: 'trajectory', source: 'default' } as any],
    isModelLoading: false,
    pointSizeMultiplier: 1.0
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
            const exists = state.activeScenes.some(s =>
                s.sceneType === scene.sceneType &&
                s.source === scene.source &&
                (s as any).analysisId === (scene as any).analysisId &&
                (s as any).exposureId === (scene as any).exposureId
            );
            if (exists) return state;
            return { activeScenes: [...state.activeScenes, scene] };
        });
    },

    removeScene(scene) {
        set((state: ModelState) => ({
            activeScenes: state.activeScenes.filter(s =>
                !(s.sceneType === scene.sceneType &&
                    s.source === scene.source &&
                    (s as any).analysisId === (scene as any).analysisId &&
                    (s as any).exposureId === (scene as any).exposureId)
            )
        }));
    },

    toggleScene(scene) {
        const state = get();
        const exists = state.activeScenes.some((s: any) =>
            s.sceneType === scene.sceneType &&
            s.source === scene.source &&
            s.analysisId === (scene as any).analysisId &&
            s.exposureId === (scene as any).exposureId
        );

        if (exists) {
            get().removeScene(scene);
        } else {
            get().addScene(scene);
        }
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
        set({ pointSizeMultiplier: Math.max(0.1, Math.min(5.0, multiplier)) });
    },

    increasePointSize() {
        set((state: ModelState) => ({
            pointSizeMultiplier: Math.min(5.0, state.pointSizeMultiplier + 0.1)
        }));
    },

    decreasePointSize() {
        set((state: ModelState) => ({
            pointSizeMultiplier: Math.max(0.1, state.pointSizeMultiplier - 0.1)
        }));
    }
});
