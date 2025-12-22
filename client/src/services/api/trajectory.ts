import api from '@/api';
import type { Trajectory } from '@/types/models';
import type { ApiResponse } from '@/types/api';

interface GetTrajectoriesParams {
    teamId?: string;
    page?: number;
    limit?: number;
    search?: string;
    populate?: string;
}

interface TrajectoryAtomsParams {
    page?: number;
    pageSize?: number;
}

interface TrajectoryAtomsResponse {
    timestep: number;
    natoms?: number;
    total?: number;
    page: number;
    pageSize: number;
    positions: number[][];
    types?: number[];
}

interface FsListResponse {
    files: Array<{
        name: string;
        type: 'file' | 'directory';
        size?: number;
        path: string;
    }>;
    currentPath: string;
}

interface TrajectoryInfo {
    name: string;
    path: string;
    id: string;
    totalFrames: number;
}

const trajectoryApi = {
    async getAll(params?: GetTrajectoriesParams): Promise<Trajectory[]>{
        const queryParams = new URLSearchParams();
        if(params?.teamId) queryParams.append('teamId', params.teamId);
        if(params?.page) queryParams.append('page', params.page.toString());
        if(params?.limit) queryParams.append('limit', params.limit.toString());
        if(params?.search) queryParams.append('search', params.search);
        if(params?.populate) queryParams.append('populate', params.populate);

        const url = `/trajectories${queryParams.toString() ? `?${queryParams}` : ''}`;
        const response = await api.get<ApiResponse<Trajectory[]>>(url);
        return response.data.data;
    },

    async getOne(id: string, populate?: string): Promise<Trajectory>{
        const url = populate ? `/trajectories/${id}?populate=${populate}` : `/trajectories/${id}`;
        const response = await api.get<ApiResponse<Trajectory>>(url);
        return response.data.data;
    },

    async create(formData: FormData, onProgress?: (progress: number) => void): Promise<Trajectory> {
        const response = await api.post<ApiResponse<Trajectory>>('/trajectories', formData, {
            onUploadProgress: (evt) => {
                const total = evt.total ?? 0;
                if(total > 0 && onProgress){
                    onProgress(Math.min(1, Math.max(0, evt.loaded / total)));
                }
            }
        });
        return response.data.data;
    },

    async update(id: string, data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>): Promise<Trajectory>{
        const response = await api.patch<ApiResponse<Trajectory>>(`/trajectories/${id}`, data);
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await api.delete(`/trajectories/${id}`);
    },

    async getPreview(trajectoryId: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<string>{
        const cacheBuster = new URLSearchParams({
            t: Date.now().toString(),
            r: Math.random().toString(36)
        }).toString();
        const response = await api.get<ApiResponse<string>>(
            `/trajectories/${trajectoryId}/preview?${cacheBuster}`,
            {
                headers: options?.headers,
                timeout: options?.timeout ?? 15000
            }
        );
        return response.data.data;
    },

    async getAllPaginated(params?: GetTrajectoriesParams & { sort?: string; q?: string }): Promise<{ data: Trajectory[]; page: number; limit: number; total: number }> {
        const response = await api.get<{ status: string; data: Trajectory[]; page: number; limit: number; total: number }>(
            '/trajectories',
            { params }
        );
        return {
            data: response.data.data,
            page: response.data.page,
            limit: response.data.limit,
            total: response.data.total
        };
    },

    async getMetrics(teamId?: string): Promise<any>{
        const response = await api.get<ApiResponse<any>>('/trajectories/metrics', {
            params: teamId ? { teamId } : undefined
        });
        return response.data.data;
    },

    /**
     * Get merged atoms: LAMMPS dump data + per-atom properties from plugin exports
     */
    async getAtoms(
        trajectoryId: string,
        analysisId: string,
        params: { timestep: number; exposureId: string; page?: number; pageSize?: number }
    ): Promise<{
        data: any[];
        properties: string[];
        page: number;
        pageSize: number;
        total: number;
        hasMore: boolean;
    } | null> {
        const response = await api.get(
            `/trajectories/${trajectoryId}/analysis/${analysisId}`,
            {
                params: {
                    timestep: params.timestep,
                    exposureId: params.exposureId,
                    page: params?.page ?? 1,
                    pageSize: params?.pageSize ?? 1000
                }
            }
        );

        const result = response.data;
        if(!result || result.status !== 'success'){
            return null;
        }

        return {
            data: result.data,
            properties: result.properties,
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            hasMore: result.hasMore
        };
    },

    vfs: {
        async list(params: { connectionId: string; path: string }): Promise<FsListResponse>{
            const response = await api.get<{ status: 'success'; data: FsListResponse }>('/trajectory-vfs/', { params });
            return response.data.data;
        },

        async download(params: { connectionId: string; path: string }): Promise<Blob>{
            const response = await api.get('/trajectory-vfs/download', {
                params,
                responseType: 'blob'
            });
            return response.data;
        },

        async getTrajectories(): Promise<TrajectoryInfo[]>{
            const response = await api.get<{ status: 'success'; data: { trajectories: TrajectoryInfo[] } }>('/trajectory-vfs/trajectories');
            return response.data.data.trajectories;
        }
    }
};

export default trajectoryApi;
