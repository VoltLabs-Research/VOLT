import api from '@/api';

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

interface FileEntry {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    permissions?: string;
}

interface CreateContainerPayload {
    name: string;
    image: string;
    team?: string;
    environment?: Record<string, string>;
    volumes?: string[];
    ports?: Record<string, number>;
    [key: string]: any;
}

const containerApi = {
    async getAll(params?: GetContainersParams): Promise<Container[]> {
        const response = await api.get<{ status: string; data: Container[] }>('/containers', { params });
        return response.data.data;
    },

    async create(data: CreateContainerPayload): Promise<Container> {
        const response = await api.post<{ status: string; data: Container }>('/containers', data);
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/containers/${id}`);
    },

    async update(id: string, data: Partial<CreateContainerPayload>): Promise<Container> {
        const response = await api.patch<{ status: string; data: Container }>(`/containers/${id}`, data);
        return response.data.data;
    },

    async control(id: string, action: 'start' | 'stop' | 'pause' | 'unpause'): Promise<void> {
        await api.post(`/containers/${id}/control`, { action });
    },

    async restart(id: string): Promise<void> {
        await api.post(`/containers/${id}/restart`);
    },

    async getStats(id: string): Promise<ContainerStats> {
        const response = await api.get<{ status: string; data: ContainerStats }>(`/containers/${id}/stats`);
        return response.data.data;
    },

    async getProcesses(id: string): Promise<ContainerProcess[]> {
        const response = await api.get<{ status: string; data: { processes: ContainerProcess[] } }>(`/containers/${id}/top`);
        return response.data.data.processes;
    },

    /**
     * File explorer operations
     */
    fileExplorer: {
        list: async (containerId: string, path: string): Promise<any> => {
            // Original: Promise<FileEntry[]>, returns response.data.data.files
            // New snippet: Promise<any>, returns response.data.data
            const response = await api.get<{ status: string; data: any }>(`/containers/${containerId}/files`, {
                params: { path }
            });
            return response.data.data;
        },

        read: async (containerId: string, path: string): Promise<any> => {
            const response = await api.get<{ status: string; data: any }>(`/containers/${containerId}/read`, {
                params: { path }
            });
            return response.data.data;
        }
    }
};

export default containerApi;
