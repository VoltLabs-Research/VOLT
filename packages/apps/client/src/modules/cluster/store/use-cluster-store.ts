import { create } from 'zustand';

interface ClusterStore {
    selectedClusterId: string | null;
    isConnected: boolean;
    setSelectedClusterId: (id: string | null) => void;
    setConnected: (connected: boolean) => void;
    reset: () => void;
}

export const useClusterStore = create<ClusterStore>((set) => ({
    selectedClusterId: null,
    isConnected: false,

    setSelectedClusterId: (id) => set({ selectedClusterId: id }),

    setConnected: (isConnected) => set({ isConnected }),

    reset: () => set({ selectedClusterId: null })
}));
