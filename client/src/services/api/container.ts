import VoltClient from '@/api';
import { getCurrentTeamId as getTeamId } from '@/stores/team/team';

const client = new VoltClient('/containers', { useRBAC: true, getTeamId });

interface Container{
    _id: string;
    name: string;
    image: string;
    status: string;
    [key: string]: any;
}

interface GetContainersParams{
    page?: number;
    limit?: number;
    search?: string;
}

interface ContainerStats{
    cpu: number;
    memory: number;
    [key: string]: any;
}

interface ContainerProcess{
    pid: string;
    user: string;
    command: string;
    [key: string]: any;
}

interface CreateContainerPayload{
    name: string;
    image: string;
    team?: string;
    env?: { key: string; value: string }[];
    volumes?: string[];
    ports?: { private: number; public: number }[];
    [key: string]: any;
}

const containerApi = {
    async getAll(params?: GetContainersParams): Promise<Container[]>{
        const response = await client.request<{ status: string; data: { containers: Container[] } }>('get', '/', {
            query: params
        });
        return response.data.data.containers;
    },

    async create(data: CreateContainerPayload): Promise<Container>{
        const response = await client.request<{ status: string; data: Container }>('post', '/', { data });
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await client.request('delete', `/${id}`);
    },

    async update(id: string, data: Partial<CreateContainerPayload>): Promise<Container>{
        const response = await client.request<{ status: string; data: Container }>('patch', `/${id}`, { data });
        return response.data.data;
    },

    async control(id: string, action: 'start' | 'stop' | 'pause' | 'unpause'): Promise<void>{
        await client.request('post', `/${id}/control`, { data: { action } });
    },

    async restart(id: string): Promise<void>{
        await client.request('post', `/${id}/restart`);
    },

    async getStats(id: string): Promise<ContainerStats>{
        const response = await client.request<{ status: string; data: { stats: ContainerStats; limits: any } }>('get', `/${id}/stats`);
        return response.data.data.stats;
    },

    async getProcesses(id: string): Promise<ContainerProcess[]>{
        const response = await client.request<{ status: string; data: { processes: ContainerProcess[] } }>('get', `/${id}/top`);
        return response.data.data.processes;
    },

    fileExplorer: {
        async list(containerId: string, path: string): Promise<any>{
            const response = await client.request<{ status: string; data: any }>('get', `/${containerId}/files`, {
                query: { path }
            });
            return response.data.data;
        },

        async read(containerId: string, path: string): Promise<any>{
            const response = await client.request<{ status: string; data: any }>('get', `/${containerId}/read`, {
                query: { path }
            });
            return response.data.data;
        }
    }
};

export default containerApi;
