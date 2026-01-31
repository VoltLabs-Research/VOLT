import { create } from 'zustand';
import { Trajectory } from '../../domain/entities';

interface TrajectoryState {
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    isLoading: boolean;
    activeUploads: Record<string, number>;
    error: string | null;
};

interface TrajectoryActions {
    setTrajectories: (items: Trajectory[]) => void;
    appendTrajectories: (items: Trajectory[]) => void;
    setTrajectory: (item: Trajectory | null) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    addTrajectory: (item: Trajectory) => void;
    removeTrajectory: (id: string) => void;
    patchTrajectory: (id: string, updates: Partial<Trajectory>) => void;
    setUploadProgress: (id: string, progress: number) => void;
    removeUpload: (id: string) => void;
    reset: () => void;
};

type TrajectoryStore = TrajectoryState & TrajectoryActions;

const initialState: TrajectoryState = {
    trajectories: [],
    trajectory: null,
    isLoading: false,
    activeUploads: {},
    error: null
};

const useTrajectoryStore = create<TrajectoryStore>((set) => ({
    ...initialState,

    setTrajectories: (items) => set({ trajectories: items }),

    appendTrajectories: (items) => set((state) => ({
        trajectories: [...state.trajectories, ...items]
    })),

    setTrajectory: (item) => set({ trajectory: item }),

    setLoading: (value) => set({ isLoading: value }),

    setError: (error) => set({ error }),

    addTrajectory: (item) => set((state) => ({
        trajectories: [item, ...state.trajectories]
    })),

    removeTrajectory: (id) => set((state) => ({
        trajectories: state.trajectories.filter((t) => t._id !== id),
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
