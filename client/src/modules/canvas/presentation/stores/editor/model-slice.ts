import type { StateCreator } from 'zustand';
import type { ModelStore, ModelState, SceneObjectType, ModelData } from '@/modules/fractal/presentation/types/stores/editor/scene-types';
import type { ModelWorldBounds } from '@/modules/fractal/presentation/types/configuration';
import { isSameScene } from '@/modules/canvas/presentation/utilities/scene-identity';

const createInitialState = (): ModelState => ({
    activeModel: null,
    activeScene: { sceneType: 'trajectory', source: 'default' },
    activeScenes: [{ sceneType: 'trajectory', source: 'default' }],
    isModelLoading: false,
    pointSizeMultiplier: 1.0,
    sceneOpacities: {},
    modelWorldBounds: null
});

export const createModelSlice: StateCreator<any, [], [], ModelStore> = (set, get) => ({
    ...createInitialState(),

    setActiveScene(scene: SceneObjectType) {
        set({
            activeScene: scene,
            activeScenes: [scene]
        });
    },

    addScene(scene: SceneObjectType) {
        set((state: ModelState) => {
            const exists = state.activeScenes.some(s => isSameScene(s, scene));
            if (exists) return state;
            return { activeScenes: [...state.activeScenes, scene] };
        });
    },

    removeScene(scene: SceneObjectType) {
        set((state: ModelState) => ({
            activeScenes: state.activeScenes.filter(s => !isSameScene(s, scene))
        }));
    },

    toggleScene(scene: SceneObjectType) {
        const state = get() as ModelState;
        const exists = state.activeScenes.some((s: SceneObjectType) => isSameScene(s, scene));

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

    setModelWorldBounds(bounds: ModelWorldBounds | null) {
        set({ modelWorldBounds: bounds });
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
        set(createInitialState());
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
