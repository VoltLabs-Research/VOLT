export interface TestSSHConnectionByIdInputDTO {
    sshConnectionId: string;
};

export interface TestSSHConnectionByIdOutputDTO {
    valid: boolean;
    error?: string;
};