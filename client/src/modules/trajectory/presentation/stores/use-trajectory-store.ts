import { create } from 'zustand';
import { Trajectory } from '../../domain/entities';
import { deduplicateById } from '@/shared/domain/utils/deduplicateById';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

export type TrajectoryUploadStatus = 'uploading' | 'waiting_for_jobs' | 'processing' | 'failed';

export interface TrajectoryUploadState {
    progress: number;
    status: TrajectoryUploadStatus;
}

interface TrajectoryStore extends BaseSlice {
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    activeUploads: Record<string, TrajectoryUploadState>;
    setTrajectories: (items: Trajectory[]) => void;
    appendTrajectories: (items: Trajectory[]) => void;
    setTrajectory: (item: Trajectory | null) => void;
    addTrajectory: (item: Trajectory) => void;
    removeTrajectory: (id: string) => void;
    patchTrajectory: (id: string, updates: Partial<Trajectory>) => void;
    setUploadProgress: (id: string, progress: number, status?: TrajectoryUploadStatus) => void;
    setUploadStatus: (id: string, status: TrajectoryUploadStatus) => void;
    removeUpload: (id: string) => void;
    reset: () => void;
};

const initialState = {
    trajectories: [] as Trajectory[],
    trajectory: null as Trajectory | null,
    activeUploads: {} as Record<string, TrajectoryUploadState>,
    ...BASE_SLICE_INITIAL_STATE
};

const useTrajectoryStore = create<TrajectoryStore>((set) => ({
    ...initialState,
    ...createBaseSlice(set),

    setTrajectories: (items) => set({ trajectories: items }),

    appendTrajectories: (items) => set((state) => ({
        trajectories: deduplicateById(state.trajectories, items)
    })),

    setTrajectory: (item) => set({ trajectory: item }),

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

    setUploadProgress: (id, progress, status) => set((state) => ({
        activeUploads: {
            ...state.activeUploads,
            [id]: {
                progress,
                status: status ?? state.activeUploads[id]?.status ?? 'uploading'
            }
        }
    })),

    setUploadStatus: (id, status) => set((state) => ({
        activeUploads: {
            ...state.activeUploads,
            [id]: {
                progress: state.activeUploads[id]?.progress ?? 0,
                status
            }
        }
    })),

    removeUpload: (id) => set((state) => {
        const { [id]: _, ...rest } = state.activeUploads;
        return { activeUploads: rest };
    }),

    reset: () => set(initialState)
}));

export default useTrajectoryStore;
