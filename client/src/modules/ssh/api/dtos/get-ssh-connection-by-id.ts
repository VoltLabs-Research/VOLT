import type { SSHConnection } from '../entities/ssh-connection';

export interface GetSSHConnectionByIdInputDTO {
    connectionId: string;
};

export type GetSSHConnectionByIdOutputDTO = SSHConnection;
