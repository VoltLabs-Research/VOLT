import api from '@/api';
import getQueryParam from '@/utilities/get-query-param';

interface Container {
    _id: string;
    name: string;
    image: string;
    status: string;
    [key: string]: any;
}

interface GetContainersParams {
    page?: number;
    limit?: number;
    search?: string;
}

interface ContainerStats {
    cpu: number;
    memory: number;
    [key: string]: any;
}

interface ContainerProcess {
    pid: string;
    user: string;
    command: string;
    [key: string]: any;
}

interface CreateContainerPayload {
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
        const response = await api.get<{ status: string; data: { containers: Container[] } }>(`/containers/${getQueryParam('team')}`, { params });
        return response.data.data.containers;
    },

    async create(data: CreateContainerPayload): Promise<Container>{
        const response = await api.post<{ status: string; data: Container }>(`/containers/${getQueryParam('team')}`, data);
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await api.delete(`/containers/${id}`);
    },

    async update(id: string, data: Partial<CreateContainerPayload>): Promise<Container>{
        const response = await api.patch<{ status: string; data: Container }>(`/containers/${getQueryParam('team')}/${id}`, data);
        return response.data.data;
    },

    async control(id: string, action: 'start' | 'stop' | 'pause' | 'unpause'): Promise<void>{
        await api.post(`/containers/${getQueryParam('team')}/${id}/control`, { action });
    },

    async restart(id: string): Promise<void>{
        await api.post(`/containers/${getQueryParam('team')}/${id}/restart`);
    },

    async getStats(id: string): Promise<ContainerStats>{
        const response = await api.get<{ status: string; data: { stats: ContainerStats; limits: any } }>(`/containers/${getQueryParam('team')}/${id}/stats`);
        return response.data.data.stats;
    },

    async getProcesses(id: string): Promise<ContainerProcess[]>{
        const response = await api.get<{ status: string; data: { processes: ContainerProcess[] } }>(`/containers/${getQueryParam('team')}/${id}/top`);
        return response.data.data.processes;
    },

    /**
     * File explorer operations
     */
    fileExplorer: {
        list: async(containerId: string, path: string): Promise<any> =>{
            const response = await api.get<{ status: string; data: any }>(`/containers/${getQueryParam('team')}/${containerId}/files`, {
                params: { path }
            });
            return response.data.data;
        },

        read: async(containerId: string, path: string): Promise<any> =>{
            const response = await api.get<{ status: string; data: any }>(`/containers/${getQueryParam('team')}/${containerId}/read`, {
                params: { path }
            });
            return response.data.data;
        }
    }
};

export default containerApi;
