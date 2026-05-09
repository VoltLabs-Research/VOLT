
import { createService, del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SSHConnection, SSHFileEntry } from './entities/ssh-connection';

export interface CreateSSHConnectionParams {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
}

export interface DeleteSSHConnectionInputDTO {
    sshConnectionId: string;
}

export interface GetSSHConnectionByIdInputDTO {
    sshConnectionId: string;
}

export interface GetSSHConnectionsInputDTO {
    page?: number;
    limit?: number;
}

export interface ListSSHFilesParams {
    sshConnectionId: string;
    path?: string;
}

export interface ListSSHFilesResponse {
    cwd: string;
    entries: SSHFileEntry[];
}

export interface TestSSHConnectionResponse {
    valid: boolean;
    error?: string;
}

export interface TestSSHConnectionInputDTO {
    sshConnectionId: string;
}

export interface UpdateSSHConnectionParams {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
}

export interface UpdateSSHConnectionInputDTO extends UpdateSSHConnectionParams {
    sshConnectionId: string;
}

const endpoints = {
    getConnections: paginated<GetSSHConnectionsInputDTO | undefined, PaginatedResponse<SSHConnection>>('/'),
    getById: get<GetSSHConnectionByIdInputDTO, SSHConnection>('/:sshConnectionId'),
    createConnection: post<CreateSSHConnectionParams, SSHConnection>('/'),
    updateConnection: patch<UpdateSSHConnectionInputDTO, SSHConnection>('/:sshConnectionId'),
    deleteConnection: del<DeleteSSHConnectionInputDTO, void>('/:sshConnectionId'),
    listFiles: get<ListSSHFilesParams, ListSSHFilesResponse>('/:sshConnectionId/files', {
        query: ({ path }) => path ? { path } : undefined
    }),
    testConnection: post<TestSSHConnectionInputDTO, TestSSHConnectionResponse>('/:sshConnectionId/connection-tests')
};

export default createService({
    clients: {
        default: {
            basePath: '/ssh/connections',
            useRBAC: true
        }
    }
}, endpoints);
