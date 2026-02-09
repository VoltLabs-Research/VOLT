import type { StateCreator } from 'zustand';
import type { ModelStore, ModelState, SceneObjectType, ModelData } from '@/modules/fractal/presentation/types/stores/editor/scene-types';

const initialState: ModelState = {
    activeModel: null,
    activeScene: { sceneType: 'trajectory', source: 'default' },
    activeScenes: [{ sceneType: 'trajectory', source: 'default' }],
    isModelLoading: false,
    pointSizeMultiplier: 1.0,
    sceneOpacities: {}
};

export const createModelSlice: StateCreator<any, [], [], ModelStore> = (set, get) => ({
    ...initialState,

    setActiveScene(scene: SceneObjectType) {
        set({
            activeScene: scene,
            activeScenes: [scene]
        });
    },

    addScene(scene: SceneObjectType) {
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

    removeScene(scene: SceneObjectType) {
        set((state: ModelState) => ({
            activeScenes: state.activeScenes.filter(s =>
                !(s.sceneType === scene.sceneType &&
                    s.source === scene.source &&
                    (s as any).analysisId === (scene as any).analysisId &&
                    (s as any).exposureId === (scene as any).exposureId)
            )
        }));
    },

    toggleScene(scene: SceneObjectType) {
        const state = get() as ModelState;
        const exists = state.activeScenes.some((s: SceneObjectType) =>
            s.sceneType === scene.sceneType &&
            s.source === scene.source &&
            (s as any).analysisId === (scene as any).analysisId &&
            (s as any).exposureId === (scene as any).exposureId
        );

        if (exists) {
            get().removeScene(scene);
        } else {
            get().addScene(scene);
        }
    },

    setModelBounds(modelBounds: ModelData['modelBounds']) {
        const { activeModel } = get() as ModelState;
        if (!activeModel) return;

        set({
            activeModel: { ...activeModel, modelBounds }
        });
    },

    setIsModelLoading(loading: boolean) {
        set({ isModelLoading: loading });
    },

    selectModel(glbs: ModelData['glbs']) {
        set({ activeModel: { glbs } });
    },

    setGlbsWithoutLoading(glbs: ModelData['glbs']) {
        set({ activeModel: { glbs } });
    },

    resetModel() {
        set({
            activeModel: null,
            isModelLoading: false,
            pointSizeMultiplier: 1.0
        });
    },

    setPointSizeMultiplier(multiplier: number) {
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
    },

    setSceneOpacity(sceneKey: string, opacity: number) {
        set((state: ModelState) => ({
            sceneOpacities: {
                ...state.sceneOpacities,
                [sceneKey]: Math.max(0, Math.min(1, opacity))
            }
        }));
    },

    getSceneOpacity(sceneKey: string): number {
        return (get() as ModelState).sceneOpacities[sceneKey] ?? 1.0;
    }
});
