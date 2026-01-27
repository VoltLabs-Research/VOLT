import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { ApiResponse } from '@/shared/types/api';
import type { ISSHRepository } from '../../domain/repositories/ISSHRepository';
import type { SSHConnection, SSHFileListResponse } from '../../domain/entities';

export class SSHRepository extends BaseRepository implements ISSHRepository {
    constructor() {
        super('/ssh', { useRBAC: false });
    }

    async getConnections(): Promise<SSHConnection[]> {
        return this.get<SSHConnection[]>('/');
    }

    async createConnection(data: any): Promise<SSHConnection> {
        return this.post<SSHConnection>('/', data);
    }

    async updateConnection(id: string, data: any): Promise<SSHConnection> {
        return this.patch<SSHConnection>(`/${id}`, data);
    }

    async deleteConnection(id: string): Promise<void> {
        await this.delete(`/${id}`);
    }

    async testConnection(id: string): Promise<{ valid: boolean; error?: string }> {
        return this.post<{ valid: boolean; error?: string }>(`/${id}/test`);
    }

    async listFiles(params: { connectionId: string; path: string }): Promise<SSHFileListResponse> {
        return this.get<SSHFileListResponse>(`/${params.connectionId}/list`, {
            query: { path: params.path }
        });
    }

    async importFile(data: { connectionId: string; remotePath: string; teamId: string; trajectoryName?: string }): Promise<void> {
        await this.post(`/${data.connectionId}/import`, {
            remotePath: data.remotePath, teamId: data.teamId, trajectoryName: data.trajectoryName
        });
    }
}

export const sshRepository = new SSHRepository();
