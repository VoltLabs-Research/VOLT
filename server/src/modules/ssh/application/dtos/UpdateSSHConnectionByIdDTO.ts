import { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';

export interface UpdateSSHConnectionByIdInputDTO{
    name?: string;
    host?: string;
    username?: string;
    port?: number;
    password?: string;
    sshConnectionId: string;
    teamId: string;
};

export interface UpdateSSHConnectionByIdOutputDTO extends SafeSSHConnectionDTO{}
