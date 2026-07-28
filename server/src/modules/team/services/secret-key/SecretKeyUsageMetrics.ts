import type {
    SecretKeyEndpointStat,
    SecretKeyStatusCodeStat,
    SecretKeyTeamUsageOverview,
    SecretKeyTeamDailySeries,
    KeyUsageMetricsStats,
    KeyUsageMetricsSeries
} from '@volt/contracts/modules/team/domain';

export type { SecretKeyEndpointStat, SecretKeyStatusCodeStat };

export interface PerKeyMetric {
    secretKeyId: string;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
}

export interface TeamUsageMetrics {
    overview: SecretKeyTeamUsageOverview;
    perKey: PerKeyMetric[];
    daily: SecretKeyTeamDailySeries;
    topEndpoints: SecretKeyEndpointStat[];
}

export interface KeyUsageMetricsRecentRequest {
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    createdAt: Date;
}

export interface KeyUsageMetrics {
    stats: KeyUsageMetricsStats;
    hourly: KeyUsageMetricsSeries;
    daily: KeyUsageMetricsSeries;
    endpoints: SecretKeyEndpointStat[];
    statusDistribution: SecretKeyStatusCodeStat[];
    recentRequests: KeyUsageMetricsRecentRequest[];
}
