export interface UpdateSSHConnectionByIdInputDTO{
    name?: string;
    host?: string;
    username?: string;
    port?: number;
    password?: string;
    sshConnectionId: string;
    teamId: string;
};
