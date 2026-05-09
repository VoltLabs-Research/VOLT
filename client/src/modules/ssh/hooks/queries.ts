import {
    buildKeys,
    createInvalidatingMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import service from '../api/service';
import type { SSHConnection } from '../api/entities/ssh-connection';
import type {
    CreateSSHConnectionParams,
    DeleteSSHConnectionInputDTO,
    GetSSHConnectionByIdInputDTO,
    GetSSHConnectionsInputDTO,
    ListSSHFilesParams,
    TestSSHConnectionInputDTO,
    TestSSHConnectionResponse,
    UpdateSSHConnectionInputDTO
} from '../api/service';

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
