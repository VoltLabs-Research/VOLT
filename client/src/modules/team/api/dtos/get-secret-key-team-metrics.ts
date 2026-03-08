import type { TeamUsageMetrics } from '../entities/secret-key-metrics';

export interface GetSecretKeyTeamMetricsInputDTO {
    teamId: string;
    days?: number;
};

export type GetSecretKeyTeamMetricsOutputDTO = TeamUsageMetrics;
