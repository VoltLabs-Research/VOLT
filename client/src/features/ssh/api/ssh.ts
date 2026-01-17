import VoltClient, { getTeamId } from '@/api';
import type { SSHConnection, CreateSSHConnectionPayload, SSHFileListResponse, TestSSHConnection } from '@/features/ssh/types';
import type { ApiResponse } from '@/types/api';

const client = new VoltClient('/ssh-connections', { useRBAC: true });
const explorerClient = new VoltClient('/ssh-file-explorer', { useRBAC: true }); 

const sshApi = {
    connections: {
        async getAll(): Promise<SSHConnection[]> {
            const response = await client.request<ApiResponse<SSHConnection[]>>('get', '/');
            return response.data.data;
        },

        async create(data: CreateSSHConnectionPayload): Promise<SSHConnection> {
            const response = await client.request<ApiResponse<SSHConnection>>('post', '/', {
                data: { ...data }
            });
            return response.data.data;
        },

        async update(id: string, data: Partial<CreateSSHConnectionPayload>): Promise<SSHConnection> {
            const response = await client.request<ApiResponse<SSHConnection>>('patch', `/${id}`, { data });
            return response.data.data;
        },

        async delete(id: string): Promise<void> {
            await client.request('delete', `/${id}`);
        },

        async test(id: string): Promise<{ valid: boolean; error?: string }> {
            const response = await client.request<ApiResponse<TestSSHConnection>>('get', `/${id}/test`);
            return response.data.data;
        }
    },

    fileExplorer: {
        async list(params: { connectionId: string; path: string }): Promise<SSHFileListResponse> {
            // ssh-file-explorer was removed. This usage is dead.
            // But leaving as is with useRBAC: false just in case route is aliased later.
            const response = await explorerClient.request<ApiResponse<SSHFileListResponse>>('get', `/list`, { config: { params } });
            return response.data.data;
        },

        async import(data: { connectionId: string; remotePath: string; teamId: string; trajectoryName?: string }): Promise<void> {
            await explorerClient.request('post', `/import`, { data });
        }
    }
};

export default sshApi;
