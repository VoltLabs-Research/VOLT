import { create } from 'zustand';

/*
 * A one-member union since the clusters panel was removed. Kept as a named id
 * rather than collapsed into `open()` so the call sites keep saying which panel
 * they mean, and so adding a second one back is a one-line change here.
 */
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
