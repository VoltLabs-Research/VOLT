import { create } from 'zustand';
import type { ModelStore } from '@/types/stores/editor/model';

const initialState = {
    activeModel: null,
    activeScene: { sceneType: 'trajectory', source: 'default' } as any, // Kept for compatibility
    activeScenes: [{ sceneType: 'trajectory', source: 'default' } as any],
    isModelLoading: false
};

const useModelStore = create<ModelStore>()((set, get) => ({
    ...initialState,

    setActiveScene(scene) {
        set({
            activeScene: scene,
            activeScenes: [scene] 
        });
    },

    addScene(scene) {
        set((state) => {
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
        set((state) => ({
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
        const exists = state.activeScenes.some(s =>
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

    setModelBounds(modelBounds: any) {
        const { activeModel } = get();
        if (!activeModel) return;

        set({
            activeModel: { ...activeModel, modelBounds }
        });
    },

    setIsModelLoading(loading: boolean) {
        set({ isModelLoading: loading });
    },

    selectModel(glbs: any) {
        set({ activeModel: { glbs } });
    },

    setGlbsWithoutLoading(glbs: any) {
        set({ activeModel: { glbs } });
    },

    reset() {
        set({
            activeModel: null,
            isModelLoading: false,
            activeScenes: [{ sceneType: 'trajectory', source: 'default' } as any],
            activeScene: { sceneType: 'trajectory', source: 'default' } as any
        });
    }
}));

export default useModelStore;
