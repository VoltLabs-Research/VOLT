
import type { KeyUsageAnalytics, TeamUsageAnalytics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageAnalytics';
import type { KeyUsageMetrics, TeamUsageMetrics } from '@modules/team/domain/contracts/secret-key/SecretKeyUsageMetrics';
import type { ISecretKeyUsageMetricsMapper } from '@modules/team/domain/port/secret-key/ISecretKeyUsageMetricsMapper';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface TeamMetricsDailySeries {
    labels: string[];
    total: number[];
    byKey: Record<string, number[]>;
};

const calcSuccessRate = (success: number, total: number): number =>
    total > 0 ? Math.round((success / total) * 1000) / 10 : 0;

@Singleton(TEAM_TOKENS.SecretKeyUsageMetricsMapper)
export default class SecretKeyUsageMetricsMapper implements ISecretKeyUsageMetricsMapper {
    toTeamMetrics(analytics: TeamUsageAnalytics): TeamUsageMetrics {
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

        const daily: TeamMetricsDailySeries = {
            labels,
            total,
            byKey
        };

        return {
            overview: {
                totalRequests: analytics.overview.totalRequests,
                successRate: calcSuccessRate(analytics.overview.successRequests, analytics.overview.totalRequests),
                avgResponseTime: Math.round(analytics.overview.avgResponseTime || 0)
            },
            perKey: analytics.perKey.map((metric) => ({
                ...metric,
                avgResponseTime: Math.round(metric.avgResponseTime || 0)
            })),
            daily,
            topEndpoints: analytics.topEndpoints
        };
    }

    toKeyMetrics(analytics: KeyUsageAnalytics): KeyUsageMetrics {
        return {
            stats: {
                totalRequests: analytics.overview.totalRequests,
                requests24h: analytics.overview.requests24h,
                requests7d: analytics.overview.requests7d,
                successRate: calcSuccessRate(analytics.overview.successRequests, analytics.overview.totalRequests),
                avgResponseTime: Math.round(analytics.overview.avgResponseTime || 0),
                peakHour: analytics.peakHour !== null
                    ? `${String(analytics.peakHour).padStart(2, '0')}:00`
                    : '--:--'
            },
            hourly: {
                labels: analytics.hourly.map((hour) => hour.label),
                data: analytics.hourly.map((hour) => hour.count)
            },
            daily: {
                labels: analytics.daily.map((day) => day.label),
                data: analytics.daily.map((day) => day.count)
            },
            endpoints: analytics.endpoints,
            statusDistribution: analytics.statusDistribution,
            recentRequests: analytics.recentRequests
        };
    }
};
