import { TeamMetricsSnapshot } from '@modules/trajectory/contracts/trajectory';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens';
import { container as diContainer } from 'tsyringe';

import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';

const MAX_QUERY_LIMIT = 10000;
const ROLLING_WEEKS = 12;

type MetricBuckets = {
    total: number;
    currMonth: number;
    prevMonth: number;
    weekly: Map<string, number>;
};

type TimeWindow = {
    now: Date;
    monthStart: Date;
    prevMonthStart: Date;
    weeksAgo: Date;
};

const createTimeWindow = (): TimeWindow => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const weeksAgo = new Date(now);

    weeksAgo.setDate(weeksAgo.getDate() - 7 * ROLLING_WEEKS);

    return {
        now,
        monthStart,
        prevMonthStart,
        weeksAgo
    };
};

const toWeekKey = (date: Date): string => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);

    return `${year}-W${String(week).padStart(2, '0')}`;
};

const createBuckets = (): MetricBuckets => ({
    total: 0,
    currMonth: 0,
    prevMonth: 0,
    weekly: new Map()
});

const updateBuckets = (buckets: MetricBuckets, createdAt: Date, window: TimeWindow): void => {
    buckets.total += 1;

    if (createdAt >= window.monthStart && createdAt < window.now) {
        buckets.currMonth += 1;
    } else if (createdAt >= window.prevMonthStart && createdAt < window.monthStart) {
        buckets.prevMonth += 1;
    }

    if (createdAt >= window.weeksAgo) {
        const key = toWeekKey(createdAt);
        buckets.weekly.set(key, (buckets.weekly.get(key) ?? 0) + 1);
    }
};

const toMonthChange = (current: number, previous: number): number => {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }

    return Math.round(((current - previous) / previous) * 100);
};

export class TeamMetricsQueryService {
    #analysisRepoCache?: IAnalysisRepository;
    private get analysisRepo(): IAnalysisRepository {
        return (this.#analysisRepoCache ??= diContainer.resolve<IAnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository));
    }

    async getTeamMetrics(teamId: string): Promise<TeamMetricsSnapshot> {
        const window = createTimeWindow();

        const trajectories = await TrajectoryModel.find({ team: teamId }).limit(MAX_QUERY_LIMIT).exec();

        const trajectoryBuckets = createBuckets();
        for (const trajectory of trajectories) {
            if (trajectory.createdAt) {
                updateBuckets(trajectoryBuckets, trajectory.createdAt, window);
            }
        }

        const trajectoryIds = trajectories.map((trajectory) => trajectory._id.toString());
        const analyses = trajectoryIds.length > 0
            ? (await this.analysisRepo.findAll({
                filter: { trajectory: { $in: trajectoryIds } } as Record<string, unknown>,
                page: 1,
                limit: MAX_QUERY_LIMIT
            })).data
            : [];

        const analysisBuckets = createBuckets();

        for (const analysis of analyses) {
            if (analysis.props.createdAt) {
                updateBuckets(analysisBuckets, analysis.props.createdAt, window);
            }
        }

        const totals: Record<string, number> = {
            trajectories: trajectoryBuckets.total,
            analysis: analysisBuckets.total
        };
        const lastMonth: Record<string, number> = {
            trajectories: toMonthChange(trajectoryBuckets.currMonth, trajectoryBuckets.prevMonth),
            analysis: toMonthChange(analysisBuckets.currMonth, analysisBuckets.prevMonth)
        };
        const series: Record<string, Map<string, number>> = {
            trajectories: trajectoryBuckets.weekly,
            analysis: analysisBuckets.weekly
        };
        const labelsSet = new Set<string>();

        for (const metrics of Object.values(series)) {
            for (const label of metrics.keys()) {
                labelsSet.add(label);
            }
        }

        const sortedLabels = Array.from(labelsSet).sort();
        const weekly: TeamMetricsSnapshot['weekly'] = {
            labels: sortedLabels
        };

        for (const [metricKey, metricSeries] of Object.entries(series)) {
            weekly[metricKey] = sortedLabels.map((label) => metricSeries.get(label) ?? 0);
        }

        return {
            totals,
            lastMonth,
            weekly
        };
    }
}

export default new TeamMetricsQueryService();
