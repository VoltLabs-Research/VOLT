import { create } from 'zustand';

interface JobsDrawerState {
    trajectoryId: string | null;
    trajectoryName: string | null;
    setScope: (scope: { trajectoryId: string | null; trajectoryName?: string | null }) => void;
}

export const useJobsDrawerStore = create<JobsDrawerState>((set) => ({
    trajectoryId: null,
    trajectoryName: null,
    setScope: ({ trajectoryId, trajectoryName = null }) => set({
        trajectoryId,
        trajectoryName
    })
}));
