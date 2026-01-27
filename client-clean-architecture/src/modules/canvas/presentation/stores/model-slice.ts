import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import { SceneSettingsService } from '@/modules/canvas/domain/services/SceneSettingsService';

const sceneSettingsService = new SceneSettingsService();

export interface ModelState {
    activeModel: any | null;
    activeScene: any;
    activeScenes: any[];
    isModelLoading: boolean;
    pointSizeMultiplier: number;
    sceneOpacities: Record<string, number>;
}

export interface ModelActions {
    setActiveScene: (scene: any) => void;
    addScene: (scene: any) => void;
    removeScene: (scene: any) => void;
    toggleScene: (scene: any) => void;
    setIsModelLoading: (loading: boolean) => void;
    selectModel: (glbs: any) => void;
    resetModel: () => void;
    setPointSizeMultiplier: (multiplier: number) => void;
}

export type ModelSlice = ModelState & ModelActions;

export const initialState: ModelState = {
    activeModel: null,
    activeScene: { sceneType: 'trajectory', source: 'default' },
    activeScenes: [{ sceneType: 'trajectory', source: 'default' }],
    isModelLoading: false,
    pointSizeMultiplier: 1.0,
    sceneOpacities: {}
};

export const createModelSlice: SliceCreator<ModelSlice> = (set, get) => ({
    ...initialState,

    setActiveScene: (scene) => {
        set({
            activeScene: scene,
            activeScenes: [scene]
        });
    },

    addScene: (scene) => {
        set((state: ModelSlice) => {
            const nextScenes = sceneSettingsService.addScene(state.activeScenes as any, scene as any);
            if (nextScenes === state.activeScenes) return state;
            return { activeScenes: nextScenes };
        });
    },

    removeScene: (scene) => {
        set((state: ModelSlice) => ({
            activeScenes: sceneSettingsService.removeScene(state.activeScenes as any, scene as any)
        }));
    },

    toggleScene: (scene) => {
        const state = get();
        const nextScenes = sceneSettingsService.toggleScene(state.activeScenes as any, scene as any);
        if (nextScenes === state.activeScenes) return;
        set({ activeScenes: nextScenes });
    },

    setIsModelLoading: (loading) => {
        set({ isModelLoading: loading });
    },

    selectModel: (glbs) => {
        set({ activeModel: { glbs } });
    },

    resetModel: () => {
        set({
            activeModel: null,
            isModelLoading: false,
            activeScenes: [{ sceneType: 'trajectory', source: 'default' }],
            activeScene: { sceneType: 'trajectory', source: 'default' },
            pointSizeMultiplier: 1.0
        });
    },

    setPointSizeMultiplier: (multiplier) => {
        set({ pointSizeMultiplier: sceneSettingsService.clampPointSize(multiplier) });
    }
});
