import type { SSHConnection } from '../entities/ssh-connection';

export interface CreateSSHConnectionParams {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
};

export type CreateSSHConnectionInputDTO = CreateSSHConnectionParams;

export type CreateSSHConnectionOutputDTO = SSHConnection;
