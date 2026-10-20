import { In } from 'typeorm';
import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';

export type TeamMetricsBucket = 'day' | 'week';

export interface TeamMetricsRange {
    from: string;
    to: string;
    bucket: TeamMetricsBucket;
    days: number;
}

export interface TeamMetricsChange {
    current: number;
    previous: number;
    changePercent: number;
}

export interface TeamMetricsSnapshot {
    totals: Record<string, number>;
    lastMonth: Record<string, TeamMetricsChange>;
    series: {
        labels: string[];
        [series: string]: number[] | string[];
    };
    range: TeamMetricsRange;
}

export interface GetTeamMetricsInput {
    teamId: string;
    days?: number;
    bucket?: string;
}

const MAX_QUERY_LIMIT = 10000;

const DEFAULT_DAYS = 84;
const MIN_DAYS = 1;
const MAX_DAYS = 365;

type MetricBuckets = {
    total: number;
    currMonth: number;
    prevMonth: number;
    series: Map<string, number>;
};

type TimeWindow = {
    now: Date;
    monthStart: Date;
    prevMonthStart: Date;
    seriesStart: Date;
    bucket: TeamMetricsBucket;
    days: number;
};

const startOfDay = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date: Date): Date => {
    const start = startOfDay(date);
    const mondayOffset = (start.getDay() + 6) % 7;

    start.setDate(start.getDate() - mondayOffset);

    return start;
};

const startOfBucket = (date: Date, bucket: TeamMetricsBucket): Date =>
    bucket === 'week' ? startOfWeek(date) : startOfDay(date);

const toDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const normalizeDays = (value: number | undefined): number => {
    if (value === undefined || !Number.isFinite(value)) {
        return DEFAULT_DAYS;
    }

    return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.trunc(value)));
};

const normalizeBucket = (value: string | undefined): TeamMetricsBucket =>
    value === 'week' ? 'week' : 'day';

const createTimeWindow = (input: GetTeamMetricsInput): TimeWindow => {
    const now = new Date();
    const days = normalizeDays(input.days);
    const bucket = normalizeBucket(input.bucket);
    const firstDay = startOfDay(now);

    firstDay.setDate(firstDay.getDate() - (days - 1));

    return {
        now,
        monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
        prevMonthStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        seriesStart: startOfBucket(firstDay, bucket),
        bucket,
        days
    };
};

const buildBucketKeys = (window: TimeWindow): string[] => {
    const step = window.bucket === 'week' ? 7 : 1;
    const lastKey = toDateKey(startOfBucket(window.now, window.bucket));
    const keys: string[] = [];
    const cursor = new Date(window.seriesStart);

    for (;;) {
        const key = toDateKey(cursor);

        keys.push(key);

        if (key >= lastKey) {
            return keys;
        }

        cursor.setDate(cursor.getDate() + step);
    }
};

const createBuckets = (): MetricBuckets => ({
    total: 0,
    currMonth: 0,
    prevMonth: 0,
    series: new Map()
});

const updateBuckets = (buckets: MetricBuckets, createdAt: Date, window: TimeWindow): void => {
    buckets.total += 1;

    if (createdAt >= window.monthStart && createdAt < window.now) {
        buckets.currMonth += 1;
    } else if (createdAt >= window.prevMonthStart && createdAt < window.monthStart) {
        buckets.prevMonth += 1;
    }

    if (createdAt >= window.seriesStart) {
        const key = toDateKey(startOfBucket(createdAt, window.bucket));

        buckets.series.set(key, (buckets.series.get(key) ?? 0) + 1);
    }
};

const toMonthChange = (current: number, previous: number): TeamMetricsChange => ({
    current,
    previous,
    changePercent: previous === 0
        ? (current > 0 ? 100 : 0)
        : Math.round(((current - previous) / previous) * 100)
});

class TeamMetricsQueryService {
    async getTeamMetrics(input: GetTeamMetricsInput): Promise<TeamMetricsSnapshot> {
        const window = createTimeWindow(input);

        const trajectories = await Trajectory.find({
            where: { team: input.teamId },
            take: MAX_QUERY_LIMIT
        });

        const trajectoryBuckets = createBuckets();
        for (const trajectory of trajectories) {
            updateBuckets(trajectoryBuckets, trajectory.createdAt, window);
        }

        const trajectoryIds = trajectories.map((trajectory) => trajectory.id);
        const analyses = trajectoryIds.length > 0
            ? await Analysis.find({
                where: { trajectory: In(trajectoryIds) },
                take: MAX_QUERY_LIMIT
            })
            : [];

        const analysisBuckets = createBuckets();

        for (const analysis of analyses) {
            updateBuckets(analysisBuckets, analysis.createdAt, window);
        }

        const totals: Record<string, number> = {
            trajectories: trajectoryBuckets.total,
            analysis: analysisBuckets.total
        };
        const lastMonth: Record<string, TeamMetricsChange> = {
            trajectories: toMonthChange(trajectoryBuckets.currMonth, trajectoryBuckets.prevMonth),
            analysis: toMonthChange(analysisBuckets.currMonth, analysisBuckets.prevMonth)
        };
        const bucketed: Record<string, Map<string, number>> = {
            trajectories: trajectoryBuckets.series,
            analysis: analysisBuckets.series
        };

        const labels = buildBucketKeys(window);
        const series: TeamMetricsSnapshot['series'] = { labels };

        for (const [metricKey, metricSeries] of Object.entries(bucketed)) {
            series[metricKey] = labels.map((label) => metricSeries.get(label) ?? 0);
        }

        return {
            totals,
            lastMonth,
            series,
            range: {
                from: labels[0],
                to: labels[labels.length - 1],
                bucket: window.bucket,
                days: window.days
            }
        };
    }
}

export default new TeamMetricsQueryService();
