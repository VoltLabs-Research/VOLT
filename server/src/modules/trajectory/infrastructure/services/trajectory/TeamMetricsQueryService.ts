import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { TeamMetricsSnapshot } from '@modules/trajectory/domain/contracts/trajectory';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ITeamMetricsQueryService } from '@modules/trajectory/domain/port/trajectory/ITeamMetricsQueryService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';

import { inject, injectable } from 'tsyringe';

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

type PluginExposureReference = {
    exposureId: string;
    exposureName: string;
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

@injectable()
export default class TeamMetricsQueryService implements ITeamMetricsQueryService {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepo: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepo: IPluginRepository
    ) {}

    async getTeamMetrics(teamId: string): Promise<TeamMetricsSnapshot> {
        const window = createTimeWindow();

        const trajectoryResult = await this.trajectoryRepo.findAll({
            filter: { team: teamId },
            page: 1,
            limit: MAX_QUERY_LIMIT
        });

        const trajectoryBuckets = createBuckets();
        for (const trajectory of trajectoryResult.data) {
            if (trajectory.props.createdAt) {
                updateBuckets(trajectoryBuckets, trajectory.props.createdAt, window);
            }
        }

        const trajectoryIds = trajectoryResult.data.map((trajectory) => trajectory._id);
        const analyses = trajectoryIds.length > 0
            ? (await this.analysisRepo.findAll({
                filter: { trajectory: { $in: trajectoryIds } } as Record<string, unknown>,
                page: 1,
                limit: MAX_QUERY_LIMIT
            })).data
            : [];

        const analysisBuckets = createBuckets();
        const pluginTrajectoryMap = new Map<string, string>();

        for (const analysis of analyses) {
            if (analysis.props.createdAt) {
                updateBuckets(analysisBuckets, analysis.props.createdAt, window);
            }

            if (!analysis.props.plugin || !analysis.props.trajectory) {
                continue;
            }

            const pluginId = String(analysis.props.plugin);
            if (!pluginTrajectoryMap.has(pluginId)) {
                pluginTrajectoryMap.set(pluginId, String(analysis.props.trajectory));
            }
        }

        const pluginIds = [...pluginTrajectoryMap.keys()];
        const plugins = pluginIds.length > 0
            ? (await this.pluginRepo.findAll({
                filter: { _id: { $in: pluginIds } } as Record<string, unknown>,
                page: 1,
                limit: pluginIds.length
            })).data
            : [];

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
        const meta: NonNullable<TeamMetricsSnapshot['meta']> = {};

        for (const metrics of Object.values(series)) {
            for (const label of metrics.keys()) {
                labelsSet.add(label);
            }
        }

        const pluginExposures = this.collectPluginExposures(plugins);

        for (const plugin of plugins) {
            const trajectoryId = pluginTrajectoryMap.get(plugin._id);
            if (!trajectoryId) {
                continue;
            }

            const pluginName = plugin.props.modifier?.name || plugin._id;

            for (const exposure of pluginExposures.get(plugin._id) ?? []) {
                const listingBuckets = createBuckets();

                totals[exposure.exposureName] = listingBuckets.total;
                lastMonth[exposure.exposureName] = toMonthChange(listingBuckets.currMonth, listingBuckets.prevMonth);
                series[exposure.exposureName] = listingBuckets.weekly;
                meta[exposure.exposureName] = {
                    displayName: exposure.exposureName,
                    pluginName,
                    target: {
                        kind: 'plugin-exposure-listing',
                        trajectoryId,
                        pluginId: plugin._id,
                        exposureId: exposure.exposureId
                    }
                };

                for (const label of listingBuckets.weekly.keys()) {
                    labelsSet.add(label);
                }
            }
        }

        if (Object.keys(meta).length === 0) {
            const teamPlugins = await this.pluginRepo.findAll({
                filter: { team: teamId } as Record<string, unknown>,
                page: 1,
                limit: 1
            });

            if (teamPlugins.data.length > 0) {
                const plugin = teamPlugins.data[0];
                const pluginName = plugin.props.modifier?.name || plugin._id;
                const firstExposure = plugin.props.exposures?.[0];
                const exposureName = firstExposure?.name || plugin._id;

                totals[exposureName] = 0;
                lastMonth[exposureName] = 0;
                series[exposureName] = new Map();
                meta[exposureName] = {
                    displayName: exposureName,
                    pluginName,
                    target: {
                        kind: 'plugins-dashboard',
                        pluginId: plugin._id,
                        exposureId: firstExposure?._id ? String(firstExposure._id) : undefined
                    }
                };
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
            weekly,
            meta
        };
    }

    private collectPluginExposures(plugins: Awaited<ReturnType<IPluginRepository['findAll']>>['data']): Map<string, PluginExposureReference[]> {
        const pluginExposures = new Map<string, PluginExposureReference[]>();

        for (const plugin of plugins) {
            const exposures = (plugin.props.exposures ?? [])
                .filter((exposure) => Boolean(exposure._id && exposure.name && exposure.hasListing))
                .map((exposure) => ({
                    exposureId: String(exposure._id),
                    exposureName: String(exposure.name)
                }));

            if (exposures.length > 0) {
                pluginExposures.set(plugin._id, exposures);
            }
        }

        return pluginExposures;
    }
};
