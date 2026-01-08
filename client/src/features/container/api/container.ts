import VoltClient from '@/api';
import type { ApiResponse } from '@/types/api';
import type {
    GetContainersParams,
    CreateContainerPayload,
    Container,
    ContainerProcess,
    ContainerStats,
    GetContainerStats,
    GetContainerProcesses
} from '../types';

const client = new VoltClient('/containers', { useRBAC: true });

const containerApi = {
    async getAll(params?: GetContainersParams): Promise<{ data: Container[], total: number }> {
        const response = await client.request<any>('get', '/', { query: params });
        const data = response.data?.data || [];
        const total = response.data?.results?.total || response.data?.page?.total || data.length;
        return { data, total };
    },

    async create(data: CreateContainerPayload): Promise<Container> {
        const response = await client.request<ApiResponse<Container>>('post', '/', { data });
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await client.request('delete', `/${id}`);
    },

    async update(id: string, data: Partial<CreateContainerPayload>): Promise<Container> {
        const response = await client.request<ApiResponse<Container>>('patch', `/${id}`, { data });
        return response.data.data;
    },

    async control(id: string, action: 'start' | 'stop' | 'pause' | 'unpause'): Promise<void> {
        await containerApi.update(id, { action });
    },

    async restart(id: string): Promise<void> {
        await containerApi.update(id, { action: 'restart' });
    },

    async getStats(id: string): Promise<ContainerStats> {
        const response = await client.request<ApiResponse<GetContainerStats>>('get', `/${id}/stats`);
        return response.data.data.stats;
    },

    async getProcesses(id: string): Promise<ContainerProcess[]> {
        const response = await client.request<ApiResponse<GetContainerProcesses>>('get', `/${id}/top`);
        return response.data.data.processes;
    },

    fileExplorer: {
        async list(containerId: string, path: string): Promise<any> {
            const response = await client.request('get', `/${containerId}/files`, {
                query: { path }
            });
            return response.data.data;
        },

        async read(containerId: string, path: string): Promise<any> {
            const response = await client.request('get', `/${containerId}/read`, {
                query: { path }
            });
            return response.data.data;
        }
    }
};

export default containerApi;
