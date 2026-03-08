import type { SSHConnection } from '../entities/ssh-connection';

export interface DeleteSSHConnectionInputDTO {
    sshConnectionId: string;
};

export type DeleteSSHConnectionOutputDTO = SSHConnection;
