import type { StateCreator } from 'zustand';
import type { RenderableExposure } from '@/modules/plugins/presentation/stores/plugin-slice';
import type { SceneObjectType } from '@/types/stores/editor/model';
import type { ActiveModifier } from '@/modules/canvas/domain/entities/ActiveModifier';
import { ModifierSelectionService } from '@/modules/canvas/domain/services/ModifierSelectionService';

export interface ResultsViewerData {
    pluginSlug: string;
    pluginName: string;
    analysisId: string;
    exposures: RenderableExposure[];
}

export interface EditorUIState {
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    showRenderConfig: boolean;
    activeModifiers: ActiveModifier[];
    isSceneInteracting: boolean;
    resultsViewerData: ResultsViewerData | null;
    exposureSettingsScene: SceneObjectType | null;
}

export interface EditorUIActions {
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

export type EditorUISlice = EditorUIState & EditorUIActions;

const modifierSelectionService = new ModifierSelectionService();

const initialState: EditorUIState = {
    showCanvasGrid: true,
    showEditorWidgets: true,
    showRenderConfig: false,
    activeModifiers: [],
    isSceneInteracting: false,
    resultsViewerData: null,
    exposureSettingsScene: null
};

export const createEditorUISlice: StateCreator<any, [], [], EditorUISlice> = (set, get) => ({
    ...initialState,

    setShowRenderConfig(enabled: boolean) {
        set({ showRenderConfig: enabled });
    },

    toggleModifier(modifierKey: string, pluginId?: string, modifierId?: string) {
        const modifiers = get().activeModifiers;
        const nextModifiers = modifierSelectionService.toggleModifier(modifiers, modifierKey, pluginId, modifierId);
        set({ activeModifiers: nextModifiers });
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
});
