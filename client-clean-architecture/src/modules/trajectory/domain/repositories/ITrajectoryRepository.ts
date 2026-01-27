import type { PaginatedResponse } from '@/shared/types/api';
import type { Trajectory, FileItem, FsListResponse } from '../entities';

export interface GetTrajectoriesParams {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    q?: string;
    teamId?: string;
}

export interface ITrajectoryRepository {
    getAll(params: GetTrajectoriesParams): Promise<Trajectory[]>;
    getAllPaginated(params: GetTrajectoriesParams): Promise<PaginatedResponse<Trajectory>>;
    getById(id: string, include?: string): Promise<Trajectory>;
    create(formData: FormData, onProgress?: (progress: number) => void): Promise<Trajectory>;
    update(id: string, data: Partial<Pick<Trajectory, 'name' | 'path'>>): Promise<Trajectory>;
    delete(id: string): Promise<void>;
    downloadDumps(trajectoryId: string, trajectoryName?: string): Promise<void>;
    getPreview(trajectoryId: string): Promise<string>;
    getMetrics(): Promise<any>;
    
    // VFS methods
    vfsList(trajectoryId: string, path: string): Promise<FsListResponse>;
    vfsDownload(trajectoryId: string, path: string): Promise<Blob>;
    vfsGetTrajectories(): Promise<any[]>;
    
    // Particle Filter methods
    getAtoms(trajectoryId: string, analysisId: string, params: any): Promise<any>;
    particleFilterGetProperties(trajectoryId: string, analysisId: string | undefined, timestep: number): Promise<{ dump: string[]; perAtom: string[] }>;
    particleFilterPreview(params: any): Promise<{ matchCount: number; totalAtoms: number }>;
    particleFilterApplyAction(params: any): Promise<{ fileId: string; atomsResult: number; action: string }>;
    particleFilterGetFilteredGLB(trajectoryId: string, analysisId: string | undefined, fileId: string): Promise<Blob>;

    // Jobs methods
    clearHistory(trajectoryId: string): Promise<any>;
    removeRunningJobs(trajectoryId: string): Promise<any>;
    retryFailedJobs(trajectoryId: string): Promise<any>;
}
