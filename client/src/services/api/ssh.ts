import VoltClient from '@/api';
import { getCurrentTeamId as getTeamId } from '@/stores/team/team';

const client = new VoltClient('/ssh-connections', { useRBAC: true, getTeamId });
const explorerClient = new VoltClient('/ssh-file-explorer', { useRBAC: true, getTeamId });

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
            const response = await client.request<{ status: 'success'; data: { connections: SSHConnection[] } }>('get', '/');
            return response.data.data.connections;
        },

        async create(data: CreateSSHConnectionPayload): Promise<SSHConnection> {
            const response = await client.request<{ status: 'success'; data: { connection: SSHConnection } }>('post', '/', { data });
            return response.data.data.connection;
        },

        async update(id: string, data: Partial<CreateSSHConnectionPayload>): Promise<SSHConnection> {
            const response = await client.request<{ status: 'success'; data: { connection: SSHConnection } }>('patch', `/${id}`, { data });
            return response.data.data.connection;
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
