import type { Analysis } from '../analysis/domain';
import type { Container } from '../container/domain';
import type { Plugin } from '../plugin/plugin';
import type { Team } from '../team/domain';
import type { Trajectory } from '../trajectory/domain';

export interface GlobalSearchResponse{
    analyses: Analysis[];
    containers: Container[];
    trajectories: Trajectory[];
    teams: Team[];
    plugins: Plugin[];
}

export type DashboardMetricsBucket = 'day' | 'week';

export interface DashboardMetricsRange{
    /** Local ISO date (YYYY-MM-DD) of the first bucket in the window. */
    from: string;
    /** Local ISO date (YYYY-MM-DD) of the last bucket in the window. */
    to: string;
    bucket: DashboardMetricsBucket;
    /** Calendar days the window spans, as requested. */
    days: number;
}

export interface DashboardMetricsSeries{
    /**
     * Local ISO date (YYYY-MM-DD) of each bucket's start, ascending and
     * contiguous: buckets with no rows are present and zero, so the gaps in a
     * series are real gaps and the x-axis is a true timeline.
     */
    labels: string[];
    [series: string]: number[] | string[];
}

export interface DashboardMetricsChange{
    /** Rows created since the 1st of the current month. */
    current: number;
    /** Rows created during the previous calendar month. */
    previous: number;
    /**
     * Rounded month-over-month change. Carries the raw counts alongside it on
     * purpose: a jump from 1 to 2 is +100%, and only the denominator tells the
     * reader whether that percentage means anything.
     */
    changePercent: number;
}

export interface DashboardMetrics{
    totals: Record<string, number>;
    lastMonth: Record<string, DashboardMetricsChange>;
    series: DashboardMetricsSeries;
    range: DashboardMetricsRange;
}
