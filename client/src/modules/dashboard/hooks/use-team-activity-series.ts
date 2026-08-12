import { useDashboardMetricsQuery } from '@/modules/dashboard/hooks/queries';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import { toBucketKey } from '@/modules/dashboard/utils/metric-buckets';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useMemo } from 'react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';
import type { DashboardMetrics } from '@volt/contracts/modules/dashboard/domain';
import type { DashboardRangeOption } from '@/modules/dashboard/contracts/range';

/**
 * One row per bucket, carrying all three measures. Every panel of the chart
 * plots this same array with a different dataKey, which is what lets a single
 * tooltip report all three without a second lookup.
 */
export interface TeamActivityPoint{
    /** Bucket key (local ISO date of the bucket start). */
    label: string;
    trajectories: number;
    analyses: number;
    actions: number;
}

const ACTIVITY_REFRESH_INTERVAL_MS = 60_000;

const readSeries = (data: DashboardMetrics, key: string): number[] => {
    const series = data.series[key];

    return Array.isArray(series)
        ? series.map((value) => (typeof value === 'number' ? value : 0))
        : [];
};

const countActionsByBucket = (
    activityData: DailyActivity[],
    range: DashboardRangeOption
): Map<string, number> => {
    const actionsByBucket = new Map<string, number>();

    for (const day of activityData) {
        const key = toBucketKey(new Date(day.date), range.bucket);

        actionsByBucket.set(key, (actionsByBucket.get(key) ?? 0) + day.activity.length);
    }

    return actionsByBucket;
};

/*
 * Trajectory/analysis counts and team actions come from two different
 * endpoints. Both are folded onto the labels the metrics endpoint returned —
 * which are contiguous and zero-filled server-side — so the three panels share
 * one true timeline instead of three independently-derived ones.
 */
const useTeamActivitySeries = (range: DashboardRangeOption) => {
    const teamId = useSelectedTeamId();
    const isEnabled = Boolean(teamId);

    const metricsQuery = useDashboardMetricsQuery({
        days: range.days,
        bucket: range.bucket
    }, {
        enabled: isEnabled
    });

    const { activityData, isLoading: isActivityLoading } = useDailyActivityData({
        range: range.days,
        scope: 'team',
        enabled: isEnabled,
        refetchIntervalMs: ACTIVITY_REFRESH_INTERVAL_MS
    });

    const points = useMemo((): TeamActivityPoint[] => {
        const data = metricsQuery.data;

        if (!data) {
            return [];
        }

        const labels = data.series.labels;
        const trajectories = readSeries(data, 'trajectories');
        const analyses = readSeries(data, 'analysis');
        const actionsByBucket = countActionsByBucket(activityData, range);

        return labels.map((label, index) => ({
            label,
            trajectories: trajectories[index] ?? 0,
            analyses: analyses[index] ?? 0,
            actions: actionsByBucket.get(label) ?? 0
        }));
    }, [metricsQuery.data, activityData, range]);

    return {
        points,
        isLoading: metricsQuery.isLoading || isActivityLoading,
        error: metricsQuery.error?.message ?? null
    };
};

export default useTeamActivitySeries;
