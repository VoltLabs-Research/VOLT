import { create } from 'zustand';

export type DashboardSidePanelId = 'jobs';

interface DashboardSidePanelState {
    openPanel: DashboardSidePanelId | null;
    open: (panel: DashboardSidePanelId) => void;
    close: () => void;
}

export const useDashboardSidePanelStore = create<DashboardSidePanelState>((set) => ({
    openPanel: null,
    open: (panel) => set({ openPanel: panel }),
    close: () => set({ openPanel: null })
}));
