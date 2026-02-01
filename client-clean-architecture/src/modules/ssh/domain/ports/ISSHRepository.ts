import type { SSHConnection, SSHFileEntry } from '../entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export interface CreateSSHConnectionParams {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
};

export interface UpdateSSHConnectionParams {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
};

export interface ListSSHFilesParams {
    connectionId: string;
    path?: string;
};

export interface ListSSHFilesResponse {
    cwd: string;
    entries: SSHFileEntry[];
};

export interface TestSSHConnectionResponse {
    valid: boolean;
    error?: string;
};

export default interface ISSHRepository {
    getConnections(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<SSHConnection>>;
    createConnection(params: CreateSSHConnectionParams): Promise<SSHConnection>;
    updateConnection(id: string, params: UpdateSSHConnectionParams): Promise<SSHConnection>;
    deleteConnection(id: string): Promise<void>;
    testConnection(id: string): Promise<TestSSHConnectionResponse>;
    listFiles(params: ListSSHFilesParams): Promise<ListSSHFilesResponse>;
};
