import { TeamUsageMetrics } from '@modules/team/domain/ports/ISecretKeyUsageLogRepository';

export interface GetSecretKeyTeamMetricsInputDTO {
    teamId: string;
    days?: number;
};

export type GetSecretKeyTeamMetricsOutputDTO = TeamUsageMetrics & {
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
