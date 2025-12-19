import type { Trajectory } from '@/types/models';
import type { RasterQuery, RasterPage } from '@/types/raster';

export interface TrajectoryState {
    trajectories: Trajectory[];
    dashboardTrajectories: Trajectory[];
    listingMeta: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
    trajectory: Trajectory | null;
    isLoading: boolean;
    isFetchingMore: boolean;
    isDashboardTrajectoriesLoading: boolean;
    uploadingFileCount: number;
    activeUploads: Record<string, { id: string; uploadProgress: number; processingProgress: number; status: 'uploading' | 'processing' }>;
    error: string | null;
    isLoadingTrajectories: boolean;
    selectedTrajectories: string[];
    trajectoryMetrics: object;
    isMetricsLoading: boolean;
}

export interface TrajectoryActions {
    getTrajectories: (teamId?: string, opts?: { force?: boolean; page?: number; limit?: number; search?: string; append?: boolean }) => Promise<void>;
    getDashboardTrajectories: (teamId?: string, opts?: { force?: boolean }) => Promise<void>;
    getTrajectoryById: (id: string) => Promise<void>;
    createTrajectory: (formData: FormData, teamId?: string, onProgress?: (progress: number) => void, existingUploadId?: string) => Promise<void>;
    updateTrajectoryById: (id: string, data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>) => Promise<void>;
    deleteTrajectoryById: (id: string, teamId?: string) => Promise<void>;
    toggleTrajectorySelection: (id: string) => void;
    deleteSelectedTrajectories: () => Promise<void>;
    getMetrics: (id: string, opts?: { force?: boolean }) => void;
    getFrameAtoms: (
        trajectoryId: string,
        timestep: number,
        opts?: { force?: boolean; page?: number; pageSize?: number }
    ) => Promise<{ timestep: number; natoms?: number; total?: number; page?: number; pageSize?: number; positions: number[][]; types?: number[] } | null>;
    setTrajectory: (trajectory: Trajectory | null) => void;
    clearError: () => void;
    reset: () => void;
    clearCurrentTrajectory: () => void;
    dismissUpload: (uploadId: string) => void;
    updateUploadProgress: (uploadId: string, progress: number, type: 'upload' | 'processing') => void;
}

export type TrajectoryStore = TrajectoryState & TrajectoryActions;
