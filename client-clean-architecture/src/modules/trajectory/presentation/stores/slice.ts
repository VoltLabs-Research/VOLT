import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { Trajectory } from '../../domain/entities';

export interface TrajectoryState {
    activeUploads: Record<string, number>;
    selectedTrajectories: string[];
}

export interface TrajectoryActions {
    toggleTrajectorySelection: (id: string) => void;
    clearCurrentTrajectory: () => void;
    addActiveUpload: (id: string) => void;
    removeActiveUpload: (id: string) => void;
    updateUploadProgress: (id: string, progress: number) => void;
}

export type TrajectorySlice = TrajectoryState & TrajectoryActions;

export const initialState: TrajectoryState = {
    activeUploads: {},
    selectedTrajectories: []
};

export const createTrajectorySlice: SliceCreator<TrajectorySlice> = (set, get) => ({
    ...initialState,

    toggleTrajectorySelection: (id) => {
        const { selectedTrajectories } = get();
        const next = selectedTrajectories.includes(id)
            ? selectedTrajectories.filter(i => i !== id)
            : [...selectedTrajectories, id];
        set({ selectedTrajectories: next });
    },

    clearCurrentTrajectory: () => {
        set({ selectedTrajectories: [] });
    },

    addActiveUpload: (id) => {
        set((state) => ({
            activeUploads: { ...state.activeUploads, [id]: 0 }
        }));
    },

    removeActiveUpload: (id) => {
        set((state) => {
            const next = { ...state.activeUploads };
            delete next[id];
            return { activeUploads: next };
        });
    },

    updateUploadProgress: (id, progress) => {
        set((state) => ({
            activeUploads: { ...state.activeUploads, [id]: progress }
        }));
    }
});
