import {
    buildKeys,
    createInvalidatingMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import service from '../api/service';
import type { SSHConnection } from '../api/entities/ssh-connection';
import type { CreateSSHConnectionParams } from '../api/dtos/create-ssh-connection';
import type { DeleteSSHConnectionInputDTO } from '../api/dtos/delete-ssh-connection';
import type { GetSSHConnectionByIdInputDTO } from '../api/dtos/get-ssh-connection-by-id';
import type { GetSSHConnectionsInputDTO } from '../api/dtos/get-ssh-connections';
import type { ListSSHFilesParams } from '../api/dtos/list-ssh-files';
import type { TestSSHConnectionInputDTO, TestSSHConnectionResponse } from '../api/dtos/test-ssh-connection';
import type { UpdateSSHConnectionInputDTO } from '../api/dtos/update-ssh-connection';

interface SSHQueryKeys extends Record<string, unknown> {
    connections: GetSSHConnectionsInputDTO;
    connectionById: GetSSHConnectionByIdInputDTO;
    files: ListSSHFilesParams;
};

const KEYS = buildKeys<SSHQueryKeys>('ssh');

export const sshConnectionsQueryKey = KEYS.connections;

export const sshConnectionsQuery = createQuery(KEYS.connections, service.getConnections);
export const sshConnectionByIdQuery = createQuery(KEYS.connectionById, service.getById);
export const sshFilesQuery = createQuery(KEYS.files, service.listFiles);

export const useCreateSSHConnectionMutation = createInvalidatingMutation<SSHConnection, CreateSSHConnectionParams>(
    service.createConnection,
    [KEYS.connections(), KEYS.connectionById()]
);

export const useUpdateSSHConnectionMutation = createInvalidatingMutation<SSHConnection, UpdateSSHConnectionInputDTO>(
    service.updateConnection,
    [KEYS.connections(), KEYS.connectionById()]
);

export const useDeleteSSHConnectionMutation = createInvalidatingMutation<void, DeleteSSHConnectionInputDTO>(
    service.deleteConnection,
    [KEYS.connections(), KEYS.connectionById()]
);

export const useTestSSHConnectionMutation = createMutation<TestSSHConnectionResponse, TestSSHConnectionInputDTO>(service.testConnection);
