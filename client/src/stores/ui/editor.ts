import { create } from 'zustand';
import type { EditorUIStore } from '@/types/stores/ui/editor';

const initialState = {
    showCanvasGrid: true,
    showEditorWidgets: true,
    activeModifiers: [],
    isSceneInteracting: false,
};

const useEditorUIStore = create<EditorUIStore>((set, get) => {
    return {
        ...initialState,

        toggleModifier(modifier: string) {
            const modifiers = new Set(get().activeModifiers);
            if (modifiers.has(modifier)) modifiers.delete(modifier);
            else modifiers.add(modifier);
            set({ activeModifiers: Array.from(modifiers) });
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
