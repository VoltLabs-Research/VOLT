import { create } from 'zustand';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';

interface DemoClusterState {
    isDemo: boolean;
    expiresAt: Date | null;
    setFromCluster: (cluster: TeamCluster | null) => void;
    clear: () => void;
}

export const useDemoClusterStore = create<DemoClusterState>((set) => ({
    isDemo: false,
    expiresAt: null,
    setFromCluster: (cluster) => {
        if (!cluster || !cluster.isDemo) {
            set({
                isDemo: false,
                expiresAt: null
            });
            return;
        }
        set({
            isDemo: true,
            expiresAt: cluster.demoExpiresAt ? new Date(cluster.demoExpiresAt) : null
        });
    },
    clear: () => set({
        isDemo: false,
        expiresAt: null
    })
}));
