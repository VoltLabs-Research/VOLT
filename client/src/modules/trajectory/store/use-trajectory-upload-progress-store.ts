import { create } from 'zustand';

interface TrajectoryUploadProgressItem {
    id: string;
    name: string;
    fileCount: number;
    totalBytes: number;
    loadedBytes: number;
    progress: number;
    startedAt: number;
    error?: string;
}

interface AddTrajectoryUploadInput {
    id: string;
    name: string;
    fileCount: number;
    totalBytes: number;
}

interface TrajectoryUploadProgressState {
    uploads: TrajectoryUploadProgressItem[];
    addUpload: (upload: AddTrajectoryUploadInput) => void;
    updateUploadProgress: (id: string, progress: number) => void;
    failUpload: (id: string, error: string) => void;
    removeUpload: (id: string) => void;
}

const clampProgress = (progress: number): number => {
    if (!Number.isFinite(progress)) return 0;
    return Math.min(1, Math.max(0, progress));
};

export const useTrajectoryUploadProgressStore = create<TrajectoryUploadProgressState>((set) => ({
    uploads: [],
    addUpload: (upload) => set((state) => {
        const nextUpload: TrajectoryUploadProgressItem = {
            ...upload,
            loadedBytes: 0,
            progress: 0,
            startedAt: Date.now()
        };

        return {
            uploads: [...state.uploads.filter((item) => item.id !== upload.id), nextUpload]
        };
    }),
    updateUploadProgress: (id, progress) => set((state) => ({
        uploads: state.uploads.map((upload) => {
            if (upload.id !== id) {
                return upload;
            }

            const nextProgress = clampProgress(progress);
            return {
                ...upload,
                progress: nextProgress,
                loadedBytes: Math.round(upload.totalBytes * nextProgress)
            };
        })
    })),
    failUpload: (id, error) => set((state) => ({
        uploads: state.uploads.map((upload) => {
            if (upload.id !== id) {
                return upload;
            }

            return {
                ...upload,
                error
            };
        })
    })),
    removeUpload: (id) => set((state) => ({
        uploads: state.uploads.filter((upload) => upload.id !== id)
    }))
}));
