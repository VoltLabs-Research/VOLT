export interface CreateSecretKeyParams {
    name: string;
    roleId: string;
};

export interface CreateSecretKeyResponse {
    secretKeyId: string;
    teamId: string;
    roleId: string;
    name: string;
    keyPrefix: string;
    secretKey: string;
    isActive: boolean;
    createdAt: Date | string;
};

export interface CreateSecretKeyInputDTO {
    teamId: string;
    name: string;
    roleId: string;
};

export type CreateSecretKeyOutputDTO = CreateSecretKeyResponse;
