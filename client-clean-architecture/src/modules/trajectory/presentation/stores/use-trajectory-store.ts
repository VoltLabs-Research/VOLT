import { create } from 'zustand';
import { Trajectory } from '../../domain/entities';
import type { ListingMeta } from '@/shared/domain/entities/ListingMeta';
import { initialListingMeta } from '@/shared/domain/entities/ListingMeta';

interface TrajectoryState {
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    listingMeta: ListingMeta;
    isLoadingList: boolean;
    isLoadingSingle: boolean;
    isFetchingMore: boolean;
    activeUploads: Record<string, number>;
    selectedIds: string[];
    error: string | null;
};

interface TrajectoryActions {
    setTrajectories: (items: Trajectory[], meta?: Partial<ListingMeta>) => void;
    appendTrajectories: (items: Trajectory[], meta?: Partial<ListingMeta>) => void;
    setTrajectory: (item: Trajectory | null) => void;
    setLoading: (type: 'list' | 'single' | 'more', value: boolean) => void;
    setError: (error: string | null) => void;
    addTrajectory: (item: Trajectory) => void;
    removeTrajectory: (id: string) => void;
    patchTrajectory: (id: string, updates: Partial<Trajectory>) => void;
    toggleSelection: (id: string) => void;
    clearSelection: () => void;
    setUploadProgress: (id: string, progress: number) => void;
    removeUpload: (id: string) => void;
    reset: () => void;
};

type TrajectoryStore = TrajectoryState & TrajectoryActions;

const initialState: TrajectoryState = {
    trajectories: [],
    trajectory: null,
    listingMeta: initialListingMeta,
    isLoadingList: true,
    isLoadingSingle: false,
    isFetchingMore: false,
    activeUploads: {},
    selectedIds: [],
    error: null
};

const useTrajectoryStore = create<TrajectoryStore>((set) => ({
    ...initialState,

    setTrajectories: (items, meta) => set((state) => ({
        trajectories: items,
        listingMeta: meta ? { ...state.listingMeta, ...meta } : state.listingMeta
    })),

    appendTrajectories: (items, meta) => set((state) => ({
        trajectories: [...state.trajectories, ...items],
        listingMeta: meta ? { ...state.listingMeta, ...meta } : state.listingMeta
    })),

    setTrajectory: (item) => set({ trajectory: item }),

    setLoading: (type, value) => set(() => {
        switch(type){
            case 'list': return { isLoadingList: value };
            case 'single': return { isLoadingSingle: value };
            case 'more': return { isFetchingMore: value };
        }
    }),

    setError: (error) => set({ error }),

    addTrajectory: (item) => set((state) => ({
        trajectories: [item, ...state.trajectories]
    })),

    removeTrajectory: (id) => set((state) => ({
        trajectories: state.trajectories.filter((t) => t._id !== id),
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
        trajectory: state.trajectory?._id === id ? null : state.trajectory
    })),

    patchTrajectory: (id, updates) => set((state) => ({
        trajectories: state.trajectories.map((t) => 
            t._id === id ? { ...t, ...updates } : t
        ),
        trajectory: state.trajectory?._id === id 
            ? { ...state.trajectory, ...updates } 
            : state.trajectory
    })),

    toggleSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id]
    })),

    clearSelection: () => set({ selectedIds: [] }),

    setUploadProgress: (id, progress) => set((state) => ({
        activeUploads: { ...state.activeUploads, [id]: progress }
    })),

    removeUpload: (id) => set((state) => {
        const { [id]: _, ...rest } = state.activeUploads;
        return { activeUploads: rest };
    }),

    reset: () => set(initialState)
}));

export default useTrajectoryStore;
