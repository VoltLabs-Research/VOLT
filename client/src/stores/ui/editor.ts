import { create } from 'zustand';
import type { EditorUIStore } from '@/types/stores/ui/editor';

export interface ActiveModifier{
    key: string;
    pluginId?: string;
    modifierId?: string;
    type: 'legacy' | 'plugin';
};

const initialState = {
    showCanvasGrid: true,
    showEditorWidgets: true,
    showRenderConfig: false,
    activeModifiers: [],
    isSceneInteracting: false,
};

const useEditorUIStore = create<EditorUIStore>((set, get) => {
    return {
        ...initialState,

        setShowRenderConfig(enabled: boolean){
            set({ showRenderConfig: enabled });
        },

        toggleModifier(modifierKey: string, pluginId?: string, modifierId?: string) {
            const modifiers = get().activeModifiers;
            const existingIndex = modifiers.findIndex((m) => m.key === modifierKey);
            if(existingIndex !== -1){
                // remove if exists
                set({
                    activeModifiers: modifiers.filter((_, i) => i !== existingIndex)
                });
            }else{
                // add new
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

        reset() {
            set(initialState);
        },
    };
});

export default useEditorUIStore;
