import type { Trajectory } from '@/types/models';
import type { RasterQuery, RasterPage } from '@/types/raster';

export interface TrajectoryState {
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    isLoading: boolean;
    isSavingPreview: boolean;
    uploadingFileCount: number;
    error: string | null;
    analysisStats: object;
    rasterData: object;
    isAnalysisLoading: boolean;
    rasterObjectUrlCache: Record<string, Record<string, string>>;
    rasterCache: Record<string, RasterPage>;
    isRasterLoading: boolean;
    isLoadingTrajectories: boolean;
    selectedTrajectories: string[];
    structureAnalysis: any;
    avgSegmentSeries: any[];
    idRateSeries: any[];
    dislocationSeries: any[];
    trajectoryMetrics: object;
    isMetricsLoading: boolean;
    cache: Record<string, Trajectory[]>;
    analysisCache: Record<string, any>;
    differencesCache: Record<string, any>;
    atomsCache?: Record<string, { timestep: number; natoms?: number; total?: number; page?: number; pageSize?: number; positions: number[][]; types?: number[] }>;
}

export interface TrajectoryActions {
    getTrajectories: (teamId?: string, opts?: { force?: boolean }) => Promise<void>;
    getTrajectoryById: (id: string) => Promise<void>;
    createTrajectory: (formData: FormData, teamId?: string) => Promise<void>;
    updateTrajectoryById: (id: string, data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>) => Promise<void>;
    deleteTrajectoryById: (id: string, teamId?: string) => Promise<void>;
    toggleTrajectorySelection: (id: string) => void;
    deleteSelectedTrajectories: () => Promise<void>;
    getMetrics: (id: string, opts?: { force?: boolean }) => void;
    getRasterizedFrames: (id: string, query?: RasterQuery & { force?: boolean }) => Promise<RasterPage | null>;
    getFrameAtoms: (
        trajectoryId: string,
        timestep: number,
        opts?: { force?: boolean; page?: number; pageSize?: number }
    ) => Promise<{ timestep: number; natoms?: number; total?: number; page?: number; pageSize?: number; positions: number[][]; types?: number[] } | null>;
    getStructureAnalysis: (teamId: string, opts?: { force?: boolean }) => Promise<void>;
    setTrajectory: (trajectory: Trajectory | null) => void;
    clearError: () => void;
    reset: () => void;
    clearCurrentTrajectory: () => void;
}

export type TrajectoryStore = TrajectoryState & TrajectoryActions;
