import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ISSHRepository from '../../domain/ports/ISSHRepository';
import type { 
    CreateSSHConnectionParams, 
    UpdateSSHConnectionParams, 
    ListSSHFilesParams, 
    ListSSHFilesResponse,
    TestSSHConnectionResponse 
} from '../../domain/ports/ISSHRepository';
import type { SSHConnection } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class SSHRepository extends BaseRepository implements ISSHRepository {
    constructor() {
        super('/ssh/connections', { useRBAC: true });
    }

    async getConnections(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<SSHConnection>> {
        return this.getAllPaginated('/', params);
    }

    async createConnection(params: CreateSSHConnectionParams): Promise<SSHConnection> {
        const response = await this.client.post<ApiResponse<SSHConnection>>('/', params);
        return this.unwrap(response);
    }

    async updateConnection(id: string, params: UpdateSSHConnectionParams): Promise<SSHConnection> {
        const response = await this.client.patch<ApiResponse<SSHConnection>>(`/${id}`, params);
        return this.unwrap(response);
    }

    async deleteConnection(id: string): Promise<void> {
        await this.client.delete(`/${id}`);
    }

    async testConnection(id: string): Promise<TestSSHConnectionResponse> {
        const response = await this.client.get<ApiResponse<TestSSHConnectionResponse>>(`/${id}/test`);
        return this.unwrap(response);
    }

    async listFiles(params: ListSSHFilesParams): Promise<ListSSHFilesResponse> {
        const { connectionId, path } = params;
        const response = await this.client.get<ApiResponse<ListSSHFilesResponse>>(`/${connectionId}/files`, { path });
        return this.unwrap(response);
    }
};
