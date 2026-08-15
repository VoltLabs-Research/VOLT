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
    from: string;
    to: string;
    bucket: DashboardMetricsBucket;
    days: number;
}

export interface DashboardMetricsSeries{
    labels: string[];
    [series: string]: number[] | string[];
}

export interface DashboardMetricsChange{
    current: number;
    previous: number;
    changePercent: number;
}

export interface DashboardMetrics{
    totals: Record<string, number>;
    lastMonth: Record<string, DashboardMetricsChange>;
    series: DashboardMetricsSeries;
    range: DashboardMetricsRange;
}
