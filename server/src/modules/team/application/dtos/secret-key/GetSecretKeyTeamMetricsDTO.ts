import type { TeamUsageMetrics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageMetrics';

export interface GetSecretKeyTeamMetricsInputDTO {
    teamId: string;
    days?: number;
}

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
