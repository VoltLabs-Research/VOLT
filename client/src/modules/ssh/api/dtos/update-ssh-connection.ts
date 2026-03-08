import type { SSHConnection } from '../entities/ssh-connection';

export interface UpdateSSHConnectionParams {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
};

export interface UpdateSSHConnectionInputDTO {
    connectionId: string;
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
};

export type UpdateSSHConnectionOutputDTO = SSHConnection;
