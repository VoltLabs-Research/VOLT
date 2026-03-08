import type { TeamUsageMetrics } from '../../entities/secret-key';

export interface GetSecretKeyTeamMetricsInputDTO {
    teamId: string;
    days?: number;
};

export type GetSecretKeyTeamMetricsOutputDTO = TeamUsageMetrics;
