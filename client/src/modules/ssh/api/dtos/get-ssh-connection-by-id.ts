import type { SSHConnection } from '../entities/ssh-connection';

export interface GetSSHConnectionByIdInputDTO {
    sshConnectionId: string;
};

export type GetSSHConnectionByIdOutputDTO = SSHConnection;
