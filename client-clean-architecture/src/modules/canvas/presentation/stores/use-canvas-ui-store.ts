import { create } from 'zustand';
import type { SceneObjectType } from '@/modules/canvas/presentation/types/stores/editor/model';
import type { IExposureComputed } from '@/modules/plugin/domain/entities';

export interface ActiveModifier {
    key: string;
    pluginId?: string;
    modifierId?: string;
    type: 'legacy' | 'plugin';
}

export interface ResultsViewerData {
    pluginSlug: string;
    pluginName: string;
    analysisId: string;
    exposures: IExposureComputed[];
}

export interface CanvasUIState {
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    showRenderConfig: boolean;
    activeModifiers: ActiveModifier[];
    isSceneInteracting: boolean;
    resultsViewerData: ResultsViewerData | null;
    exposureSettingsScene: SceneObjectType | null;
}

export interface CanvasUIActions {
    setShowRenderConfig: (enabled: boolean) => void;
    toggleModifier: (modifierKey: string, pluginId?: string, modifierId?: string) => void;
    toggleCanvasGrid: () => void;
    toggleEditorWidgets: () => void;
    setSceneInteracting: (isInteracting: boolean) => void;
    setResultsViewerData: (data: ResultsViewerData | null) => void;
    closeResultsViewer: () => void;
    resetEditorUI: () => void;
    openExposureSettings: (scene: SceneObjectType) => void;
    closeExposureSettings: () => void;
}

type CanvasUIStore = CanvasUIState & CanvasUIActions;

const initialState: CanvasUIState = {
    showCanvasGrid: true,
    showEditorWidgets: true,
    showRenderConfig: false,
    activeModifiers: [],
    isSceneInteracting: false,
    resultsViewerData: null,
    exposureSettingsScene: null
};

const useCanvasUIStore = create<CanvasUIStore>((set, get) => ({
    ...initialState,

    setShowRenderConfig(enabled: boolean) {
        set({ showRenderConfig: enabled });
    },

    toggleModifier(modifierKey: string, pluginId?: string, modifierId?: string) {
        const modifiers = get().activeModifiers;
        const existingIndex = modifiers.findIndex((m: ActiveModifier) => m.key === modifierKey);
        if (existingIndex !== -1) {
            set({
                activeModifiers: modifiers.filter((_: ActiveModifier, i: number) => i !== existingIndex)
            });
        } else {
            const newModifier: ActiveModifier = {
                key: modifierKey,
                pluginId,
                modifierId,
                type: pluginId && modifierId ? 'plugin' : 'legacy'
            };

            let nextModifiers = [...modifiers];

            if (newModifier.type === 'plugin') {
                nextModifiers = nextModifiers.filter(m => m.type !== 'plugin');
            }

            set({ activeModifiers: [...nextModifiers, newModifier] });
        }
    },

    toggleCanvasGrid() {
        set({ showCanvasGrid: !get().showCanvasGrid });
    },

    toggleEditorWidgets() {
        set({ showEditorWidgets: !get().showEditorWidgets });
    },

    setSceneInteracting(isInteracting: boolean) {
        set({ isSceneInteracting: isInteracting });
    },

    setResultsViewerData(data: ResultsViewerData | null) {
        set({ resultsViewerData: data });
    },

    closeResultsViewer() {
        set({ resultsViewerData: null });
    },

    resetEditorUI() {
        set(initialState);
    },

    openExposureSettings(scene: SceneObjectType) {
        set({ exposureSettingsScene: scene });
    },

    closeExposureSettings() {
        set({ exposureSettingsScene: null });
    }
}));

export default useCanvasUIStore;
