import { create } from 'zustand';

const useUIStore = create((set) => ({
    showCanvasGrid: true,
    toggleCanvasGrid: () => set((state) => ({ showCanvasGrid: !state.showCanvasGrid })),

    showEditorWidgets: true,
    toggleEditorWidgets: () => set((state) => ({ showEditorWidgets: !state.showEditorWidgets })),

    showShortcutsModal: false,
    toggleShortcutsModal: () => set((state) => ({ showShortcutsModal: !state.showShortcutsModal }))
}));

export default useUIStore;