export interface TestSSHConnectionByIdInputDTO {
    sshConnectionId: string;
    teamId: string;
};

export interface TestSSHConnectionByIdOutputDTO {
    valid: boolean;
};
