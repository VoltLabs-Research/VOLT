import type { SSHConnection } from '../entities/ssh-connection';

export interface DeleteSSHConnectionInputDTO {
    connectionId: string;
};

export type DeleteSSHConnectionOutputDTO = SSHConnection;
