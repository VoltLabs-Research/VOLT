import { ErrorCodes } from '@core/constants/error-codes';
import { z } from 'zod';
import type { KeyUsageMetrics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageMetrics';

export type GetSecretKeyUsageInputDTO = z.output<typeof getSecretKeyUsageInputSchema>;

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

export const secretKeyUsageWindowSchema = z.coerce.number().int().min(1).max(365).optional();

export const getSecretKeyUsageInputSchema = z.object({
    teamId: z.string().min(1, ErrorCodes.TEAM_ID_REQUIRED),
    secretKeyId: z.string().min(1, ErrorCodes.SECRET_KEY_PARAMS_REQUIRED),
    days: secretKeyUsageWindowSchema
});
