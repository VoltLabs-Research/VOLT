import { defineServiceModule } from '@/shared/api/service-module';
import { del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { CreateSSHConnectionParams } from './dtos/create-ssh-connection';
import type { DeleteSSHConnectionInputDTO } from './dtos/delete-ssh-connection';
import type { GetSSHConnectionByIdInputDTO } from './dtos/get-ssh-connection-by-id';
import type { GetSSHConnectionsInputDTO } from './dtos/get-ssh-connections';
import type { ListSSHFilesParams, ListSSHFilesResponse } from './dtos/list-ssh-files';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SSHConnection } from './entities/ssh-connection';
import type { TestSSHConnectionInputDTO, TestSSHConnectionResponse } from './dtos/test-ssh-connection';
import type { UpdateSSHConnectionInputDTO } from './dtos/update-ssh-connection';

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

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/ssh/connections',
            useRBAC: true
        }
    },
    endpoints
});
