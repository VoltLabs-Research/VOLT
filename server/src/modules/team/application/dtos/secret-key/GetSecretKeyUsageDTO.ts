import { KeyUsageMetrics } from '@modules/team/domain/ports/ISecretKeyUsageLogRepository';

export interface GetSecretKeyUsageInputDTO {
    teamId: string;
    secretKeyId: string;
    days?: number;
};

export interface GetSecretKeyUsageOutputDTO extends KeyUsageMetrics {
    key: {
        _id: string;
        name: string;
        keyPrefix: string;
        roleName: string;
        isActive: boolean;
        createdAt: Date;
        lastUsedAt: Date | null;
    };
};
