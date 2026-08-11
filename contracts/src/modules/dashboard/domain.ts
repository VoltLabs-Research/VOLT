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

export interface DashboardWeeklySeries{
    labels: string[];
    [series: string]: number[] | string[];
}

export interface DashboardMetrics{
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: DashboardWeeklySeries;
}
