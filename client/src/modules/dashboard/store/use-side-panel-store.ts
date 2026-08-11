import { create } from 'zustand';

export type DashboardSidePanelId = 'jobs' | 'clusters';

interface DashboardSidePanelState {
    openPanel: DashboardSidePanelId | null;
    lastPanel: DashboardSidePanelId;
    open: (panel: DashboardSidePanelId) => void;
    close: () => void;
}

export const useDashboardSidePanelStore = create<DashboardSidePanelState>((set) => ({
    openPanel: null,
    lastPanel: 'jobs',
    open: (panel) => set({ openPanel: panel, lastPanel: panel }),
    close: () => set({ openPanel: null })
}));
