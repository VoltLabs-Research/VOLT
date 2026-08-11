import { successRateOf } from '@modules/team/services/secret-key/SecretKeyUsageAnalyticsQueries';
import type {
    KeyUsageAnalytics,
    SecretKeyUsagePerKey,
    SecretKeyUsageRequest,
    TeamUsageAnalytics
} from '@modules/team/services/secret-key/SecretKeyUsageAnalyticsQueries';
import type {
    KeyUsageMetricsSeries,
    KeyUsageMetricsStats,
    SecretKeyEndpointStat,
    SecretKeyStatusCodeStat,
    SecretKeyTeamDailySeries,
    SecretKeyTeamUsageOverview
} from '@volt/contracts/modules/team/domain';

interface TeamUsageMetrics {
    overview: SecretKeyTeamUsageOverview;
    perKey: SecretKeyUsagePerKey[];
    daily: SecretKeyTeamDailySeries;
    topEndpoints: SecretKeyEndpointStat[];
}

interface KeyUsageMetrics {
    stats: KeyUsageMetricsStats;
    hourly: KeyUsageMetricsSeries;
    daily: KeyUsageMetricsSeries;
    endpoints: SecretKeyEndpointStat[];
    statusDistribution: SecretKeyStatusCodeStat[];
    recentRequests: SecretKeyUsageRequest[];
}

const toSeries = (rows: Array<{ label: string; count: number }>): KeyUsageMetricsSeries => ({
    labels: rows.map((row) => row.label),
    data: rows.map((row) => row.count)
});

export const toTeamMetrics = (analytics: TeamUsageAnalytics): TeamUsageMetrics => {
    const dateSet = new Set<string>();
    const keyDayMap: Record<string, Record<string, number>> = {};

    for (const row of analytics.daily) {
        dateSet.add(row.date);
        keyDayMap[row.secretKeyId] ||= {};
        keyDayMap[row.secretKeyId][row.date] = row.count;
    }

    const labels = Array.from(dateSet).sort();
    const byKey: Record<string, number[]> = {};
    const total = labels.map(() => 0);

    for (const [keyId, dayMap] of Object.entries(keyDayMap)) {
        byKey[keyId] = labels.map((label, index) => {
            const count = dayMap[label] || 0;
            total[index] += count;
            return count;
        });
    }

    return {
        overview: {
            totalRequests: analytics.overview.totalRequests,
            successRate: successRateOf(analytics.overview.successRequests, analytics.overview.totalRequests),
            avgResponseTime: Math.round(analytics.overview.avgResponseTime || 0)
        },
        perKey: analytics.perKey.map((metric) => ({
            ...metric,
            avgResponseTime: Math.round(metric.avgResponseTime || 0)
        })),
        daily: {
            labels,
            total,
            byKey
        },
        topEndpoints: analytics.topEndpoints
    };
};

export const toKeyMetrics = (analytics: KeyUsageAnalytics): KeyUsageMetrics => ({
    stats: {
        totalRequests: analytics.overview.totalRequests,
        requests24h: analytics.overview.requests24h,
        requests7d: analytics.overview.requests7d,
        successRate: successRateOf(analytics.overview.successRequests, analytics.overview.totalRequests),
        avgResponseTime: Math.round(analytics.overview.avgResponseTime || 0),
        peakHour: analytics.peakHour !== null
            ? `${String(analytics.peakHour).padStart(2, '0')}:00`
            : '--:--'
    },
    hourly: toSeries(analytics.hourly),
    daily: toSeries(analytics.daily),
    endpoints: analytics.endpoints,
    statusDistribution: analytics.statusDistribution,
    recentRequests: analytics.recentRequests
});
