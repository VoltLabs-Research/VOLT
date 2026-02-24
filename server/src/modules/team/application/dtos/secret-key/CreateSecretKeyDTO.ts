export interface CreateSecretKeyInputDTO {
    teamId: string;
    roleId: string;
    name: string;
    userId?: string;
}

export interface CreateSecretKeyOutputDTO {
    secretKeyId: string;
    teamId: string;
    roleId: string;
    name: string;
    keyPrefix: string;
    secretKey: string;
    isActive: boolean;
    createdAt: Date;
}
