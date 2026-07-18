export type TeamAuthenticationType = 'user' | 'secret-key';

export interface GetCurrentSecretKeyInputDTO {
    authType?: TeamAuthenticationType;
    secretKeyId?: string;
};

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
};
