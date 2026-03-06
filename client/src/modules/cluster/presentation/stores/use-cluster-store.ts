import { create } from 'zustand';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import { DEFAULT_CLUSTER_ID } from '@/modules/cluster/domain/constants';

interface ClusterState {
    clusters: ClusterMetrics[];
    selectedClusterId: string;
    isConnected: boolean;
    isHistoryLoaded: boolean;
    history: ClusterMetrics[];
};

interface ClusterActions {
    setClusters: (clusters: ClusterMetrics[]) => void;
    setSelectedClusterId: (id: string) => void;
    setConnected: (connected: boolean) => void;
    setHistoryLoaded: (loaded: boolean) => void;
    setHistory: (history: ClusterMetrics[]) => void;
    resetHistory: () => void;
    reset: () => void;
};

type ClusterStore = ClusterState & ClusterActions;

const initialState: ClusterState = {
    clusters: [],
    selectedClusterId: DEFAULT_CLUSTER_ID,
    isConnected: false,
    isHistoryLoaded: false,
    history: []
};

export const useClusterStore = create<ClusterStore>((set) => ({
    ...initialState,

    setClusters: (clusters) => {
        set((state) => {
            const currentExists = clusters.some((c) => c.clusterId === state.selectedClusterId);
            const newSelectedId = currentExists || clusters.length === 0
                ? state.selectedClusterId
                : clusters[0].clusterId;

            return {
                clusters,
                selectedClusterId: newSelectedId
            };
        });
    },

    setSelectedClusterId: (id) => set({ selectedClusterId: id }),

    setConnected: (isConnected) => set({ isConnected }),

    setHistoryLoaded: (isHistoryLoaded) => set({ isHistoryLoaded }),

    setHistory: (history) => set({ history, isHistoryLoaded: true }),

    resetHistory: () => set({
        history: [],
        isHistoryLoaded: false
    }),

    reset: () => set(initialState)
}));
