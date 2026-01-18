import { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';

export interface CreateSSHConnectionInputDTO{
    name: string;
    host: string;
    port: number;
    password: string;
    userId: string;
    teamId: string;
    username: string;
};

export interface CreateSSHConnectionOutputDTO extends SSHConnectionProps{}