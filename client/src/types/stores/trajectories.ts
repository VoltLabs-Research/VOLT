import type { Trajectory } from '@/types/models';

export interface TrajectoryState {
    trajectories: Trajectory[];
    listingMeta: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
    trajectory: Trajectory | null;
    isLoading: boolean;
    isFetchingMore: boolean;
    activeUploads: Record<string, number>;
    error: string | null;
    isLoadingTrajectories: boolean;
    selectedTrajectories: string[];
    trajectoryMetrics: object;
    isMetricsLoading: boolean;
}

export interface TrajectoryActions {
    getTrajectories: (teamId?: string, opts?: { force?: boolean; page?: number; limit?: number; search?: string; append?: boolean }) => Promise<void>;
    getTrajectoryById: (id: string) => Promise<void>;
    createTrajectory: (formData: FormData) => Promise<Trajectory>;
    updateTrajectoryById: (id: string, data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>) => Promise<void>;
    deleteTrajectoryById: (id: string, teamId?: string) => Promise<void>;
    toggleTrajectorySelection: (id: string) => void;
    deleteSelectedTrajectories: () => Promise<void>;
    getMetrics: (id: string, opts?: { force?: boolean }) => void;
    reset: () => void;
    clearCurrentTrajectory: () => void;
    initializeSocket?: (teamId: string) => (() => void) | void;
}

export type TrajectoryStore = TrajectoryState & TrajectoryActions;
