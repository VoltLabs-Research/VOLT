import { create } from 'zustand';

type UIState = {
    showCanvasGrid: boolean;
    toggleCanvasGrid: () => void;

    activeModifiers: string[];
    toggleModifier: (modifier: string) => void;
    addModifier: (modifier: string) => void;
    removeModifier: (modifier: string) => void;
    hasModifier: (modifier: string) => boolean;

    isDashboardSidebarEnabled: boolean;
    toggleDashboardSidebar: () => void;

    showEditorWidgets: boolean;
    toggleEditorWidgets: () => void;

    showShortcutsModal: boolean;
    toggleShortcutsModal: () => void;
};

const useUIStore = create<UIState>((set, get) => ({
    showCanvasGrid: true,
    toggleCanvasGrid: () => set((s) => ({ showCanvasGrid: !s.showCanvasGrid })),

    activeModifiers: [],
    hasModifier: (modifier) => get().activeModifiers.includes(modifier),

    addModifier: (modifier) => set((s) => {
        if(s.activeModifiers.includes(modifier)) return s;
        return { activeModifiers: [...s.activeModifiers, modifier] };
    }),

    removeModifier: (modifier) => set((s) => ({
        activeModifiers: s.activeModifiers.filter((m) => m !== modifier),
    })),

    toggleModifier: (modifier) => set((s) => {
        const setMods = new Set(s.activeModifiers);
        if (setMods.has(modifier)) setMods.delete(modifier);
        else setMods.add(modifier);
        return { activeModifiers: Array.from(setMods) };
    }),

    isDashboardSidebarEnabled: false,
    toggleDashboardSidebar: () => set((s) => ({ 
        isDashboardSidebarEnabled: !s.isDashboardSidebarEnabled 
    })),

    showEditorWidgets: true,
    toggleEditorWidgets: () => set((s) => ({ showEditorWidgets: !s.showEditorWidgets })),

    showShortcutsModal: false,
    toggleShortcutsModal: () => set((s) => ({ showShortcutsModal: !s.showShortcutsModal })),
}));

export default useUIStore;