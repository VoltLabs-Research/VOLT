import { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';

export interface GetSSHConnectionByIdInputDTO{
    sshConnectionId: string;
    teamId: string;
};

export interface GetSSHConnectionByIdOutputDTO extends SafeSSHConnectionDTO{}
