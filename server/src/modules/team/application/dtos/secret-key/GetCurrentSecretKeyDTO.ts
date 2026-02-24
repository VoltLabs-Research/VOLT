export interface GetCurrentSecretKeyInputDTO {
    authType?: 'user' | 'secret-key';
    secretKeyId?: string;
}

export interface GetCurrentSecretKeyOutputDTO {
    _id: string;
    team: string;
    role: string;
    createdBy: string;
    name: string;
    keyPrefix: string;
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
