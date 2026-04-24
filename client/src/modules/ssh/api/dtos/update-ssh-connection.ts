export interface UpdateSSHConnectionParams {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
};

export interface UpdateSSHConnectionInputDTO {
    sshConnectionId: string;
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
};
