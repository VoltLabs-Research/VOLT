import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import VoltClient from '@/shared/infrastructure/api';

import type { ApiResponse, PaginatedResponse } from '@/shared/types/api';
import type { ITrajectoryRepository, GetTrajectoriesParams } from '../../domain/repositories/ITrajectoryRepository';
import type { Trajectory, FileItem, FsListResponse } from '../../domain/entities';

export class TrajectoryRepository extends BaseRepository implements ITrajectoryRepository {
    private readonly vfsClient: VoltClient;
    private readonly vfsOpsClient: VoltClient;
    private readonly particleFilterClient: VoltClient;
    private readonly jobsClient: VoltClient;

    constructor() {
        super('/trajectory', { useRBAC: true });
        this.vfsClient = new VoltClient('/trajectory-vfs', { useRBAC: true });
        this.vfsOpsClient = new VoltClient('/trajectory-vfs', { useRBAC: false });
        this.particleFilterClient = new VoltClient('/particle-filter', { useRBAC: true });
        this.jobsClient = new VoltClient('/trajectory-jobs', { useRBAC: true });
    }

    async getAll(params: GetTrajectoriesParams): Promise<Trajectory[]> {
        return this.get<Trajectory[]>('/', { query: params });
    }

    async getAllPaginated(params: GetTrajectoriesParams): Promise<PaginatedResponse<Trajectory>> {
        return this.get<PaginatedResponse<Trajectory>>('/', { query: params });
    }

    async getById(id: string, include?: string): Promise<Trajectory> {
        return this.get<Trajectory>(`/${id}`, { query: include ? { include } : undefined });
    }

    async create(formData: FormData, onProgress?: (progress: number) => void): Promise<Trajectory> {
        const response = await this.client.request<ApiResponse<Trajectory>>('post', '/', {
            data: formData,
            config: {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (evt) => {
                    const total = evt.total ?? 0;
                    if (total > 0 && onProgress) {
                        onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                    }
                }
            }
        });
        return response.data.data;
    }

    async update(id: string, data: Partial<Pick<Trajectory, 'name'>>): Promise<Trajectory> {
        return this.patch<Trajectory>(`/${id}`, data);
    }

    async delete(id: string): Promise<void> {
        await this.client.request('delete', `/${id}`);
    }

    async downloadDumps(trajectoryId: string, trajectoryName?: string): Promise<void> {
        const response = await this.client.request<Blob>('get', `/${trajectoryId}/download`, {
            config: { responseType: 'blob' },
            dedupe: false
        });

        const url = URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${trajectoryName || 'trajectory'}-dumps.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async getPreview(trajectoryId: string): Promise<string> {
        const cacheBuster = new URLSearchParams({
            t: Date.now().toString(),
            r: Math.random().toString(36)
        }).toString();

        // getPreview expects response.data.data to be string
        return this.get<string>(`/${trajectoryId}/preview?${cacheBuster}`, {
            config: { timeout: 15000 },
            dedupe: false
        });
    }

    async getMetrics(): Promise<any> {
        return this.get<any>('/metrics');
    }

    async vfsList(trajectoryId: string, path: string): Promise<FsListResponse> {
        const response = await this.vfsOpsClient.request<ApiResponse<FsListResponse>>('get', `/${trajectoryId}`, {
            query: { path }
        });
        return response.data.data;
    }

    async vfsDownload(trajectoryId: string, path: string): Promise<Blob> {
        const response = await this.vfsOpsClient.request<Blob>('get', `/${trajectoryId}/files`, {
            query: { path },
            config: {
                responseType: 'blob'
            },
            dedupe: false
        });
        return response.data;
    }

    async vfsGetTrajectories(): Promise<any[]> {
        const response = await this.vfsClient.request<ApiResponse<{ trajectories: any[] }>>('get', '/trajectories');
        return response.data.data.trajectories;
    }

    async getAtoms(trajectoryId: string, analysisId: string, params: any): Promise<any> {
        return this.get<any>(`/${trajectoryId}/analysis/${analysisId}`, { query: params });
    }

    async particleFilterGetProperties(trajectoryId: string, analysisId: string | undefined, timestep: number): Promise<{ dump: string[]; perAtom: string[] }> {
        const path = analysisId ? `/properties/${trajectoryId}/${analysisId}` : `/properties/${trajectoryId}`;
        const response = await this.particleFilterClient.request<ApiResponse<{ dump: string[]; perAtom: string[] }>>('get', path, {
            query: { timestep }
        });
        return response.data.data;
    }

    async particleFilterPreview(params: any): Promise<{ matchCount: number; totalAtoms: number }> {
        const { trajectoryId, analysisId, ...queryParams } = params;
        const path = analysisId ? `/preview/${trajectoryId}/${analysisId}` : `/preview/${trajectoryId}`;
        const response = await this.particleFilterClient.request<ApiResponse<{ matchCount: number; totalAtoms: number }>>('get', path, {
            query: queryParams
        });
        return response.data.data;
    }

    async particleFilterApplyAction(params: any): Promise<{ fileId: string; atomsResult: number; action: string }> {
        const { trajectoryId, analysisId, timestep, action, ...bodyParams } = params;
        const path = analysisId ? `/${trajectoryId}/${analysisId}` : `/${trajectoryId}`;
        const response = await this.particleFilterClient.request<ApiResponse<{ fileId: string; atomsResult: number; action: string }>>('post', path, {
            query: { timestep, action },
            data: bodyParams
        });
        return response.data.data;
    }

    async particleFilterGetFilteredGLB(trajectoryId: string, analysisId: string | undefined, fileId: string): Promise<Blob> {
        const path = analysisId ? `/${trajectoryId}/${analysisId}` : `/${trajectoryId}`;
        const response = await this.particleFilterClient.request<Blob>('get', path, {
            query: { fileId },
            config: { responseType: 'blob' },
            dedupe: false
        });
        return response.data;
    }

    async clearHistory(trajectoryId: string): Promise<any> {
        const response = await this.jobsClient.request<ApiResponse<any>>('patch', `/${trajectoryId}/jobs/clear-history`);
        return response.data.data;
    }

    async removeRunningJobs(trajectoryId: string): Promise<any> {
        const response = await this.jobsClient.request<ApiResponse<any>>('patch', `/${trajectoryId}/jobs/remove-running`);
        return response.data.data;
    }

    async retryFailedJobs(trajectoryId: string): Promise<any> {
        const response = await this.jobsClient.request<ApiResponse<any>>('patch', `/${trajectoryId}/jobs/retry-failed`);
        return response.data.data;
    }
}

export const trajectoryRepository = new TrajectoryRepository();
