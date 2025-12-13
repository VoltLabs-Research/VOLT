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
    async getAll(params?: GetTrajectoriesParams): Promise<Trajectory[]> {
        const queryParams = new URLSearchParams();
        if (params?.teamId) queryParams.append('teamId', params.teamId);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.search) queryParams.append('search', params.search);
        if (params?.populate) queryParams.append('populate', params.populate);

        const url = `/trajectories${queryParams.toString() ? `?${queryParams}` : ''}`;
        const response = await api.get<ApiResponse<Trajectory[]>>(url);
        return response.data.data;
    },

    async getOne(id: string, populate?: string): Promise<Trajectory> {
        const url = populate ? `/trajectories/${id}?populate=${populate}` : `/trajectories/${id}`;
        const response = await api.get<ApiResponse<Trajectory>>(url);
        return response.data.data;
    },

    async create(formData: FormData): Promise<Trajectory> {
        const response = await api.post<ApiResponse<Trajectory>>('/trajectories', formData);
        return response.data.data;
    },

    async update(id: string, data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>): Promise<Trajectory> {
        const response = await api.patch<ApiResponse<Trajectory>>(`/trajectories/${id}`, data);
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/trajectories/${id}`);
    },

    async getPreview(trajectoryId: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<string> {
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

    async getMetrics(teamId?: string): Promise<any> {
        const response = await api.get<ApiResponse<any>>('/trajectories/metrics', {
            params: teamId ? { teamId } : undefined
        });
        return response.data.data;
    },

    async getAtoms(trajectoryId: string, timestep: number, params?: TrajectoryAtomsParams): Promise<TrajectoryAtomsResponse | null> {
        const response = await api.get(`/trajectories/${trajectoryId}/atoms/${timestep}`, {
            responseType: 'json',
            params: {
                page: params?.page ?? 1,
                pageSize: params?.pageSize ?? 100000
            }
        });

        const data = response.data?.data || response.data;
        if (!data || !Array.isArray(data.positions)) {
            return null;
        }

        return {
            timestep: Number(data.timestep ?? timestep),
            natoms: typeof data.natoms === 'number' ? data.natoms : undefined,
            total: typeof data.total === 'number' ? data.total : undefined,
            page: typeof data.page === 'number' ? data.page : (params?.page ?? 1),
            pageSize: typeof data.pageSize === 'number' ? data.pageSize : (params?.pageSize ?? 100000),
            positions: data.positions as number[][],
            types: Array.isArray(data.types) ? data.types as number[] : undefined
        };
    },

    vfs: {
        async list(params: { connectionId: string; path: string }): Promise<FsListResponse> {
            const response = await api.get<{ status: 'success'; data: FsListResponse }>('/trajectory-vfs/', { params });
            return response.data.data;
        },

        async download(params: { connectionId: string; path: string }): Promise<Blob> {
            const response = await api.get('/trajectory-vfs/download', {
                params,
                responseType: 'blob'
            });
            return response.data;
        },

        async getTrajectories(): Promise<TrajectoryInfo[]> {
            const response = await api.get<{ status: 'success'; data: { trajectories: TrajectoryInfo[] } }>('/trajectory-vfs/trajectories');
            return response.data.data.trajectories;
        }
    }
};

export default trajectoryApi;
