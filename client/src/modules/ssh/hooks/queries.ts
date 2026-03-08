import { useMutation } from '@tanstack/react-query';
import {
    batchInvalidateQueries,
    buildKeys,
    createMutation,
    createQuery,
    type MutationOptions,
    withSuccess
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

const KEYS = buildKeys<{
    connections: GetSSHConnectionsInputDTO;
    connectionById: GetSSHConnectionByIdInputDTO;
    files: ListSSHFilesParams;
}>('ssh');

export const sshConnectionsQueryKey = KEYS.connections;

export const sshConnectionsQuery = createQuery(KEYS.connections, service.getConnections);
export const sshConnectionByIdQuery = createQuery(KEYS.connectionById, service.getById);
export const sshFilesQuery = createQuery(KEYS.files, service.listFiles);


export const invalidateSSHConnectionQueries = () => {
    return batchInvalidateQueries([
        KEYS.connections(),
        KEYS.connectionById()
    ]);
};

export const useCreateSSHConnectionMutation = (options?: MutationOptions<SSHConnection, CreateSSHConnectionParams>) => {
    return useMutation({
        ...options,
        mutationFn: service.createConnection,
        onSuccess: withSuccess(() => {
            void invalidateSSHConnectionQueries();
        }, options)
    });
};

export const useUpdateSSHConnectionMutation = (options?: MutationOptions<SSHConnection, UpdateSSHConnectionInputDTO>) => {
    return useMutation({
        ...options,
        mutationFn: service.updateConnection,
        onSuccess: withSuccess(() => {
            void invalidateSSHConnectionQueries();
        }, options)
    });
};

export const useDeleteSSHConnectionMutation = (options?: MutationOptions<void, DeleteSSHConnectionInputDTO>) => {
    return useMutation({
        ...options,
        mutationFn: service.deleteConnection,
        onSuccess: withSuccess(() => {
            void invalidateSSHConnectionQueries();
        }, options)
    });
};

export const useTestSSHConnectionMutation = createMutation<TestSSHConnectionResponse, TestSSHConnectionInputDTO>(service.testConnection);
