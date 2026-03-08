import { paginated, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SSHConnection } from '../../entities/ssh-connection';
import type { GetSSHConnectionsInputDTO } from '../../dtos/get-ssh-connections';
import type { CreateSSHConnectionParams } from '../../dtos/create-ssh-connection';
import type { UpdateSSHConnectionInputDTO } from '../../dtos/update-ssh-connection';
import type { DeleteSSHConnectionInputDTO } from '../../dtos/delete-ssh-connection';

const endpoints = {
    getConnections: paginated<GetSSHConnectionsInputDTO | undefined, PaginatedResponse<SSHConnection>>('/'),
    getById: get<{ connectionId: string }, SSHConnection>('/:connectionId'),
    createConnection: post<CreateSSHConnectionParams, SSHConnection>('/'),
    updateConnection: patch<UpdateSSHConnectionInputDTO, SSHConnection>('/:connectionId'),
    deleteConnection: del<DeleteSSHConnectionInputDTO, void>('/:connectionId')
};

export default endpoints;
