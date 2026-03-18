import { create } from 'zustand';

interface ClusterState {
    selectedClusterId: string | null;
    isConnected: boolean;
};

interface ClusterActions {
    setSelectedClusterId: (id: string | null) => void;
    setConnected: (connected: boolean) => void;
    reset: () => void;
};

type ClusterStore = ClusterState & ClusterActions;

const initialState: ClusterState = {
    selectedClusterId: null,
    isConnected: false
};

export const useClusterStore = create<ClusterStore>((set) => ({
    ...initialState,

    setSelectedClusterId: (id) => set({ selectedClusterId: id }),

    setConnected: (isConnected) => set({ isConnected }),

    reset: () => set(initialState)
}));
