import { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';

export interface PersistedSSHConnectionDTO extends SSHConnectionProps {
    _id: string;
}

export type SafeSSHConnectionDTO = Omit<PersistedSSHConnectionDTO, 'encryptedPassword'>;

export interface CreateSSHConnectionInputDTO{
    name: string;
    host: string;
    port: number;
    password: string;
    userId: string;
    teamId: string;
    username: string;
};

export interface CreateSSHConnectionOutputDTO extends SafeSSHConnectionDTO{}
