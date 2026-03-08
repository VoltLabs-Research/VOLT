export interface TestSSHConnectionResponse {
    valid: boolean;
    error?: string;
};

export interface TestSSHConnectionInputDTO {
    connectionId: string;
};

export type TestSSHConnectionOutputDTO = TestSSHConnectionResponse;
