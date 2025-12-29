import VoltClient from '@/api';
import type { SSHConnection, CreateSSHConnectionPayload, SSHFileListResponse } from './types';

const client = new VoltClient('/ssh-connections', { useRBAC: true });
const explorerClient = new VoltClient('/ssh-file-explorer', { useRBAC: true });

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
            const response = await client.request<{ status: 'success'; data: { valid: boolean; error?: string } }>('get', `/${id}/test`);
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
