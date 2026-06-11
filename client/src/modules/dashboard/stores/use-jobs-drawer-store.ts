import { create } from 'zustand';

/**
 * Stable ids for the dashboard chrome drawers, shared by the bottom bar (which
 * opens them) and DashboardLayout (which mounts them). Centralized so the
 * imperative openModal/closeModal calls can't drift apart.
 */
export const DASHBOARD_DRAWER_IDS = {
    jobs: 'dashboard-jobs-drawer',
    clusters: 'dashboard-clusters-drawer',
    activity: 'dashboard-activity-drawer',
    presence: 'dashboard-presence-drawer'
} as const;

interface JobsDrawerState {
    /**
     * When set, the jobs drawer scopes its viewer to a single trajectory
     * (opened from a trajectory's three-dot menu). When null, it shows the
     * full team-wide jobs history (opened from the bottom bar).
     */
    trajectoryId: string | null;
    /** Display name for the scoped trajectory, used in the drawer title. */
    trajectoryName: string | null;
    setScope: (scope: { trajectoryId: string | null; trajectoryName?: string | null }) => void;
}

export const useJobsDrawerStore = create<JobsDrawerState>((set) => ({
    trajectoryId: null,
    trajectoryName: null,
    setScope: ({ trajectoryId, trajectoryName = null }) => set({ trajectoryId, trajectoryName })
}));
