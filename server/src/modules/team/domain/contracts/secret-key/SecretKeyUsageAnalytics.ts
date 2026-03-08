import type { KeyUsageMetrics, TeamUsageMetrics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageMetrics';

export interface TeamUsageOverviewAnalytics {
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
};

export interface TeamUsagePerKeyAnalytics {
    secretKeyId: string;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
};

export interface TeamUsageDailyAnalytics {
    date: string;
    secretKeyId: string;
    count: number;
};

export interface TeamUsageAnalytics {
    overview: TeamUsageOverviewAnalytics;
    perKey: TeamUsagePerKeyAnalytics[];
    daily: TeamUsageDailyAnalytics[];
    topEndpoints: TeamUsageMetrics['topEndpoints'];
};

export interface KeyUsageOverviewAnalytics extends TeamUsageOverviewAnalytics {
    requests24h: number;
    requests7d: number;
};

export interface UsageCountByLabelAnalytics {
    label: string;
    count: number;
};

export interface KeyUsageRecentRequestAnalytics {
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    createdAt: Date;
};

export interface KeyUsageAnalytics {
    overview: KeyUsageOverviewAnalytics;
    hourly: UsageCountByLabelAnalytics[];
    daily: UsageCountByLabelAnalytics[];
    endpoints: KeyUsageMetrics['endpoints'];
    statusDistribution: KeyUsageMetrics['statusDistribution'];
    peakHour: number | null;
    recentRequests: KeyUsageRecentRequestAnalytics[];
};
