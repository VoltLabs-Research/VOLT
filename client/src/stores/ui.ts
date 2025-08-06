import { create } from 'zustand';

const useUIStore = create((set) => ({
    showCanvasGrid: true,
    toggleCanvasGrid: () => set((state) => ({ showCanvasGrid: !state.showCanvasGrid })),

    isDashboardSidebarEnabled: false,
    toggleDashboardSidebar: () => set((state) => ({ isDashboardSidebarEnabled: !state.isDashboardSidebarEnabled })),

    showEditorWidgets: true,
    toggleEditorWidgets: () => set((state) => ({ showEditorWidgets: !state.showEditorWidgets })),

    showShortcutsModal: false,
    toggleShortcutsModal: () => set((state) => ({ showShortcutsModal: !state.showShortcutsModal }))
}));

export default useUIStore;