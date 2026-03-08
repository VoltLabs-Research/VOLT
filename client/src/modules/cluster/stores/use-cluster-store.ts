import { create } from 'zustand';
import { DEFAULT_CLUSTER_ID } from '../api/entities/cluster-constants';

interface ClusterState {
    selectedClusterId: string;
    isConnected: boolean;
}

interface ClusterActions {
    setSelectedClusterId: (id: string) => void;
    setConnected: (connected: boolean) => void;
    reset: () => void;
}

type ClusterStore = ClusterState & ClusterActions;

const initialState: ClusterState = {
    selectedClusterId: DEFAULT_CLUSTER_ID,
    isConnected: false
};

export const useClusterStore = create<ClusterStore>((set) => ({
    ...initialState,

    setSelectedClusterId: (id) => set({ selectedClusterId: id }),

    setConnected: (isConnected) => set({ isConnected }),

    reset: () => set(initialState)
}));
