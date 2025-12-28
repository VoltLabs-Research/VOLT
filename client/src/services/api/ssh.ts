import VoltClient from '@/api';

const client = new VoltClient('/ssh-connections', { useRBAC: true });
const explorerClient = new VoltClient('/ssh-file-explorer', { useRBAC: true });

export interface SSHConnection {
    _id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    user: string;
    createdAt: string;
    updatedAt: string;
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
    entries: Array<{
        name: string;
        type: 'file' | 'dir';
        size?: number;
        mtime?: string;
        relPath: string;
    }>;
    cwd: string;
}

const sshApi = {
    connections: {
        async getAll(): Promise<SSHConnection[]> {
            // BaseController returns { status, data: [...] }
            const response = await client.request<{ status: 'success'; data: SSHConnection[] }>('get', '/');
            return response.data.data;
        },

        async create(data: CreateSSHConnectionPayload): Promise<SSHConnection> {
            const response = await client.request<{ status: 'success'; data: SSHConnection }>('post', '/', { data });
            return response.data.data;
        },

        async update(id: string, data: Partial<CreateSSHConnectionPayload>): Promise<SSHConnection> {
            const response = await client.request<{ status: 'success'; data: SSHConnection }>('patch', `/${id}`, { data });
            return response.data.data;
        },

        async delete(id: string): Promise<void> {
            await client.request('delete', `/${id}`);
        },

        async test(id: string): Promise<{ valid: boolean; error?: string }> {
            const response = await client.request<{ status: 'success'; data: { valid: boolean; error?: string } }>('post', `/${id}/test`);
            return response.data.data;
        }
    },

    fileExplorer: {
        async list(params: { connectionId: string; path: string }): Promise<SSHFileListResponse> {
            const response = await explorerClient.request<{ status: 'success'; data: SSHFileListResponse }>('get', `/list`, { config: { params } });
            return response.data.data;
        },

        async import(data: { connectionId: string; remotePath: string; teamId: string; trajectoryName?: string }): Promise<void> {
            await explorerClient.request('post', `/import`, { data });
        }
    }
};

export default sshApi;
