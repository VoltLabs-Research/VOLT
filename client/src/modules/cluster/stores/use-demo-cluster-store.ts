import { create } from 'zustand';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

interface DemoClusterState {
    isDemo: boolean;
    expiresAt: Date | null;
    setFromCluster: (cluster: TeamCluster | null) => void;
    clear: () => void;
};

const toDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
};

export const useDemoClusterStore = create<DemoClusterState>((set) => ({
    isDemo: false,
    expiresAt: null,
    setFromCluster: (cluster) => {
        if (!cluster || !cluster.isDemo) {
            set({ isDemo: false, expiresAt: null });
            return;
        }
        set({
            isDemo: true,
            expiresAt: toDate(cluster.demoExpiresAt)
        });
    },
    clear: () => set({ isDemo: false, expiresAt: null })
}));
