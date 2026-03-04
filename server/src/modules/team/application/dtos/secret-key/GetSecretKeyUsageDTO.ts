import { KeyUsageMetrics } from '@modules/team/application/dtos/secret-key/SecretKeyUsageTypes';

export interface GetSecretKeyUsageInputDTO {
    teamId: string;
    secretKeyId: string;
    days?: number;
};

export interface GetSecretKeyUsageOutputDTO extends KeyUsageMetrics {
    key: {
        id: string;
        name: string;
        keyPrefix: string;
        roleName: string;
        isActive: boolean;
        createdAt: Date;
        lastUsedAt: Date | null;
    };
};
