import { paginated, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SSHConnection } from '@/modules/ssh/api/entities/ssh-connection';
import type { GetSSHConnectionByIdInputDTO } from '@/modules/ssh/api/dtos/get-ssh-connection-by-id';
import type { GetSSHConnectionsInputDTO } from '@/modules/ssh/api/dtos/get-ssh-connections';
import type { CreateSSHConnectionParams } from '@/modules/ssh/api/dtos/create-ssh-connection';
import type { UpdateSSHConnectionInputDTO } from '@/modules/ssh/api/dtos/update-ssh-connection';
import type { DeleteSSHConnectionInputDTO } from '@/modules/ssh/api/dtos/delete-ssh-connection';

const endpoints = {
    getConnections: paginated<GetSSHConnectionsInputDTO | undefined, PaginatedResponse<SSHConnection>>('/'),
    getById: get<GetSSHConnectionByIdInputDTO, SSHConnection>('/:sshConnectionId'),
    createConnection: post<CreateSSHConnectionParams, SSHConnection>('/'),
    updateConnection: patch<UpdateSSHConnectionInputDTO, SSHConnection>('/:sshConnectionId'),
    deleteConnection: del<DeleteSSHConnectionInputDTO, void>('/:sshConnectionId')
};

export default endpoints;
