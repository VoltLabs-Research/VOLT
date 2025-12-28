import VoltClient from '@/api';
import type { GetContainersParams, CreateContainerPayload, Container, ContainerProcess, ContainerStats } from './types';

const client = new VoltClient('/containers', { useRBAC: true });

const containerApi = {
    async getAll(params?: GetContainersParams): Promise<Container[]> {
        const response = await client.request<{ status: string; data: Container[] }>('get', '/', {
            query: params
        });
        return response.data.data;
    },

    async create(data: CreateContainerPayload): Promise<Container> {
        const response = await client.request<{ status: string; data: Container }>('post', '/', { data });
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await client.request('delete', `/${id}`);
    },

    async update(id: string, data: Partial<CreateContainerPayload>): Promise<Container> {
        const response = await client.request<{ status: string; data: Container }>('patch', `/${id}`, { data });
        return response.data.data;
    },

    async control(id: string, action: 'start' | 'stop' | 'pause' | 'unpause'): Promise<void> {
        await containerApi.update(id, { action });
    },

    async restart(id: string): Promise<void> {
        await containerApi.update(id, { action: 'restart' });
    },

    async getStats(id: string): Promise<ContainerStats> {
        const response = await client.request<{ status: string; data: { stats: ContainerStats; limits: any } }>('get', `/${id}/stats`);
        return response.data.data.stats;
    },

    async getProcesses(id: string): Promise<ContainerProcess[]> {
        const response = await client.request<{ status: string; data: { processes: ContainerProcess[] } }>('get', `/${id}/top`);
        return response.data.data.processes;
    },

    fileExplorer: {
        async list(containerId: string, path: string): Promise<any> {
            const response = await client.request<{ status: string; data: any }>('get', `/${containerId}/files`, {
                query: { path }
            });
            return response.data.data;
        },

        async read(containerId: string, path: string): Promise<any> {
            const response = await client.request<{ status: string; data: any }>('get', `/${containerId}/read`, {
                query: { path }
            });
            return response.data.data;
        }
    }
};

export default containerApi;
