import { SSHConnectionProps } from "../../domain/entities/SSHConnection";

export interface UpdateSSHConnectionByIdInputDTO{
    name: string;
    host: string;
    username: string;
    port: number;
    sshConnectionId: string;
};

export interface UpdateSSHConnectionByIdOutputDTO extends SSHConnectionProps{}