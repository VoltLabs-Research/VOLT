import { create } from 'zustand';

export const DASHBOARD_DRAWER_IDS = {
    jobs: 'dashboard-jobs-drawer',
    clusters: 'dashboard-clusters-drawer',
    activity: 'dashboard-activity-drawer',
    presence: 'dashboard-presence-drawer'
} as const;

interface JobsDrawerState {
    
    trajectoryId: string | null;
    
    trajectoryName: string | null;
    setScope: (scope: { trajectoryId: string | null; trajectoryName?: string | null }) => void;
}

export const useJobsDrawerStore = create<JobsDrawerState>((set) => ({
    trajectoryId: null,
    trajectoryName: null,
    setScope: ({ trajectoryId, trajectoryName = null }) => set({ trajectoryId, trajectoryName })
}));
