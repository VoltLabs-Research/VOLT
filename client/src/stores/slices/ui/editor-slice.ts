import type { StateCreator } from 'zustand';

export interface ActiveModifier {
    key: string;
    pluginId?: string;
    modifierId?: string;
    type: 'legacy' | 'plugin';
}

export interface EditorUIState {
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    showRenderConfig: boolean;
    activeModifiers: ActiveModifier[];
    isSceneInteracting: boolean;
}

export interface EditorUIActions {
    setShowRenderConfig: (enabled: boolean) => void;
    toggleModifier: (modifierKey: string, pluginId?: string, modifierId?: string) => void;
    toggleCanvasGrid: () => void;
    toggleEditorWidgets: () => void;
    setSceneInteracting: (isInteracting: boolean) => void;
    resetEditorUI: () => void;
}

export type EditorUISlice = EditorUIState & EditorUIActions;

const initialState: EditorUIState = {
    showCanvasGrid: true,
    showEditorWidgets: true,
    showRenderConfig: false,
    activeModifiers: [],
    isSceneInteracting: false
};

export const createEditorUISlice: StateCreator<any, [], [], EditorUISlice> = (set, get) => ({
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
            set({ activeModifiers: [...modifiers, newModifier] });
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

    resetEditorUI() {
        set(initialState);
    }
});

