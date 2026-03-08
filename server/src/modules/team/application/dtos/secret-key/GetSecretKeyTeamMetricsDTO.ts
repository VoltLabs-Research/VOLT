import { ErrorCodes } from '@core/constants/error-codes';
import { z } from 'zod';
import type { TeamUsageMetrics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageMetrics';

export type GetSecretKeyTeamMetricsInputDTO = z.input<typeof getSecretKeyTeamMetricsInputSchema>;

export type GetSecretKeyTeamMetricsOutputDTO = Omit<TeamUsageMetrics, 'perKey'> & {
    totalKeys: number;
    activeKeys: number;
    revokedKeys: number;
    perKey: Array<TeamUsageMetrics['perKey'][number] & {
        name: string;
        keyPrefix: string;
        roleName: string;
        isActive: boolean;
    }>;
};

export const getSecretKeyTeamMetricsInputSchema = z.object({
    teamId: z.string().min(1, ErrorCodes.TEAM_ID_REQUIRED),
    days: z.coerce.number().int().min(1).max(365).optional()
});
