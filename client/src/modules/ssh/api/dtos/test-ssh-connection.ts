export interface TestSSHConnectionResponse {
    valid: boolean;
    error?: string;
};

export interface TestSSHConnectionInputDTO {
    sshConnectionId: string;
};
