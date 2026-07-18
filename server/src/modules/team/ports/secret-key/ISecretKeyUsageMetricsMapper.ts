import type { KeyUsageAnalytics, TeamUsageAnalytics } from '@modules/team/contracts/secret-key/SecretKeyUsageAnalytics';
import type { KeyUsageMetrics, TeamUsageMetrics } from '@modules/team/contracts/secret-key/SecretKeyUsageMetrics';

export interface ISecretKeyUsageMetricsMapper {
    toTeamMetrics(analytics: TeamUsageAnalytics): TeamUsageMetrics;
    toKeyMetrics(analytics: KeyUsageAnalytics): KeyUsageMetrics;
}
