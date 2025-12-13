import api from '@/api';

interface SSHConnection {
    _id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    [key: string]: any;
}

interface CreateSSHConnectionPayload {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
}

interface SSHFileListResponse {
    files: Array<{
        name: string;
        type: 'file' | 'directory';
        size?: number;
        modified?: string;
        path: string;
    }>;
    currentPath: string;
}

const sshApi = {
    connections: {
        async getAll(): Promise<SSHConnection[]>{
            const response = await api.get<{ status: 'success'; data: { connections: SSHConnection[] } }>('/ssh-connections');
            return response.data.data.connections;
        },

        async create(data: CreateSSHConnectionPayload): Promise<SSHConnection>{
            const response = await api.post<{ status: 'success'; data: { connection: SSHConnection } }>('/ssh-connections', data);
            return response.data.data.connection;
        },

        async delete(id: string): Promise<void>{
            await api.delete(`/ssh-connections/${id}`);
        },

        async test(id: string): Promise<{ valid: boolean; error?: string }> {
            const response = await api.post<{ status: 'success'; data: { valid: boolean; error?: string } }>(`/ssh-connections/${id}/test`);
            return response.data.data;
        }
    },

    fileExplorer: {
        async list(params: { connectionId: string; path: string }): Promise<SSHFileListResponse>{
            const response = await api.get<{ status: 'success'; data: SSHFileListResponse }>('/ssh-file-explorer/list', { params });
            return response.data.data;
        },

        async import(data: { connectionId: string; remotePath: string; trajectoryName?: string }): Promise<void>{
            await api.post('/ssh-file-explorer/import', data);
        }
    }
};

export default sshApi;
