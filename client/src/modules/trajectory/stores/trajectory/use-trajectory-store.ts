import { create } from 'zustand';

export type TrajectoryUploadStatus = 'uploading' | 'waiting_for_jobs' | 'processing' | 'failed';

const EMPTY_ACTIVE_UPLOADS: Record<string, TrajectoryUploadState> = {};

export interface TrajectoryUploadState {
    progress: number;
    status: TrajectoryUploadStatus;
};

interface TrajectoryStore {
    activeUploads: Record<string, TrajectoryUploadState>;
    setUploadProgress: (id: string, progress: number, status?: TrajectoryUploadStatus) => void;
    setUploadStatus: (id: string, status: TrajectoryUploadStatus) => void;
    removeUpload: (id: string) => void;
    reset: () => void;
};

const initialState = {
    activeUploads: EMPTY_ACTIVE_UPLOADS
};

export default create<TrajectoryStore>((set) => ({
    ...initialState,

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
