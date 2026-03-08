import type { KeyUsageMetrics } from '../../entities/secret-key';

export interface GetSecretKeyUsageInputDTO {
    teamId: string;
    secretKeyId: string;
    days?: number;
};

export type GetSecretKeyUsageOutputDTO = KeyUsageMetrics;
