import { injectable, inject } from 'tsyringe';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import { GetTeamMetricsInputDTO, GetTeamMetricsOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTeamMetricsDTO';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

type Pointer = {
    trajectoryId: string;
    analysisId: string;
    createdAt?: Date;
};

type MetricBuckets = {
    total: number;
    currMonth: number;
    prevMonth: number;
    weekly: Map<string, number>;
};

@injectable()
export default class GetTeamMetricsUseCase implements IUseCase<GetTeamMetricsInputDTO, GetTeamMetricsOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepo: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepo: IPluginRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepo: IListingRowRepository
    ) {}

    async execute(input: GetTeamMetricsInputDTO): Promise<Result<GetTeamMetricsOutputDTO, ApplicationError>> {
        const { teamId } = input;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const weeksAgo = new Date(now);
        weeksAgo.setDate(weeksAgo.getDate() - 7 * 12);

        const toWeekKey = (d: Date) => {
            const year = d.getFullYear();
            const startOfYear = new Date(year, 0, 1);
            const days = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
            const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
            return `${year}-W${String(week).padStart(2, '0')}`;
        };

        const pct = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return Math.round(((curr - prev) / prev) * 100);
        };

        const createBuckets = (): MetricBuckets => ({
            total: 0,
            currMonth: 0,
            prevMonth: 0,
            weekly: new Map()
        });

        const updateBuckets = (buckets: MetricBuckets, createdAt: Date) => {
            buckets.total += 1;
            if (createdAt >= monthStart && createdAt < now) {
                buckets.currMonth += 1;
            } else if (createdAt >= prevMonthStart && createdAt < monthStart) {
                buckets.prevMonth += 1;
            }
            if (createdAt >= weeksAgo) {
                const key = toWeekKey(createdAt);
                buckets.weekly.set(key, (buckets.weekly.get(key) ?? 0) + 1);
            }
        };

        // Get trajectories
        const trajectoryResult = await this.trajectoryRepo.findAll({
            filter: { team: teamId },
            page: 1,
            limit: 10000
        });

        const trajectoryBuckets = createBuckets();
        for (const t of trajectoryResult.data) {
            if (t.props.createdAt) updateBuckets(trajectoryBuckets, t.props.createdAt);
        }

        const trajectoryIds = trajectoryResult.data.map(t => t.id);

        // Get analyses
        const analysisResult = await this.analysisRepo.findAll({
            filter: { trajectory: { $in: trajectoryIds } } as any,
            page: 1,
            limit: 10000
        });

        const analysisBuckets = createBuckets();
        const pointersByPlugin = new Map<string, Pointer[]>();

        for (const a of analysisResult.data) {
            if (a.props.createdAt) updateBuckets(analysisBuckets, a.props.createdAt);

            if (a.props.plugin && a.props.trajectory) {
                const pluginId = String(a.props.plugin);
                const arr = pointersByPlugin.get(pluginId) ?? [];
                arr.push({
                    trajectoryId: String(a.props.trajectory),
                    analysisId: a.id,
                    createdAt: a.props.createdAt
                });
                pointersByPlugin.set(pluginId, arr);
            }
        }

        // Get plugins
        const pluginIds = [...pointersByPlugin.keys()];
        const plugins = pluginIds.length > 0
            ? await Promise.all(pluginIds.map(id => this.pluginRepo.findById(id)))
            : [];

        const totals: Record<string, number> = {
            trajectories: trajectoryBuckets.total,
            analysis: analysisBuckets.total
        };
        const lastMonth: Record<string, number> = {
            trajectories: pct(trajectoryBuckets.currMonth, trajectoryBuckets.prevMonth),
            analysis: pct(analysisBuckets.currMonth, analysisBuckets.prevMonth)
        };
        const labelsSet = new Set<string>();
        const series: Record<string, Map<string, number>> = {
            trajectories: trajectoryBuckets.weekly,
            analysis: analysisBuckets.weekly
        };
        const meta: Record<string, any> = {};

        for (const [, map] of Object.entries(series)) {
            for (const key of map.keys()) labelsSet.add(key);
        }

        // Process plugin listings
        for (const plugin of plugins) {
            if (!plugin) continue;

            const pluginId = plugin.id;
            const pointers = pointersByPlugin.get(pluginId) ?? [];
            if (!pointers.length) continue;

            const workflow = plugin.props.workflow;
            const exposureNodes = workflow?.props?.nodes?.filter(
                (n: any) => n.type === WorkflowNodeType.Exposure
            ) ?? [];
            if (!exposureNodes.length) continue;

            const modifierNode = workflow?.props?.nodes?.find(
                (n: any) => n.type === WorkflowNodeType.Modifier
            );
            const pluginName = modifierNode?.data?.modifier?.name || plugin.props.slug;

            const analysisIds = pointers.map(p => p.analysisId);

            for (const exposureNode of exposureNodes) {
                const listingSlug = exposureNode.data?.exposure?.name;
                if (!listingSlug) continue;

                // Count listing rows
                const listingResult = await this.listingRowRepo.findAll({
                    filter: {
                        plugin: pluginId,
                        listingSlug,
                        analysis: { $in: analysisIds }
                    } as any,
                    page: 1,
                    limit: 10000
                });

                const listingBuckets = createBuckets();
                for (const row of listingResult.data) {
                    if (row.props.createdAt) updateBuckets(listingBuckets, row.props.createdAt);
                }

                const first = pointers[0];
                const listingUrl = `/dashboard/trajectory/${first.trajectoryId}/plugin/${plugin.props.slug}/listing/${listingSlug}`;

                totals[listingSlug] = listingBuckets.total;
                lastMonth[listingSlug] = pct(listingBuckets.currMonth, listingBuckets.prevMonth);
                series[listingSlug] = listingBuckets.weekly;
                meta[listingSlug] = { displayName: listingSlug, listingUrl, pluginName };

                for (const key of listingBuckets.weekly.keys()) labelsSet.add(key);
            }
        }

        // Add placeholder plugin if no analyses exist but team has plugins
        if (Object.keys(meta).length === 0) {
            const teamPlugins = await this.pluginRepo.findAll({
                filter: { team: teamId } as any,
                page: 1,
                limit: 1
            });

            if (teamPlugins.data.length > 0) {
                const plugin = teamPlugins.data[0];
                const workflow = plugin.props.workflow;
                const modifierNode = workflow?.props?.nodes?.find(
                    (n: any) => n.type === WorkflowNodeType.Modifier
                );
                const pluginName = modifierNode?.data?.modifier?.name || plugin.props.slug;

                const exposureNode = workflow?.props?.nodes?.find(
                    (n: any) => n.type === WorkflowNodeType.Exposure
                );
                const listingSlug = exposureNode?.data?.exposure?.name || plugin.props.slug;

                totals[listingSlug] = 0;
                lastMonth[listingSlug] = 0;
                series[listingSlug] = new Map();
                meta[listingSlug] = {
                    displayName: listingSlug,
                    listingUrl: `/dashboard/plugins`,
                    pluginName
                };
            }
        }

        // Build weekly response
        const sortedLabels = Array.from(labelsSet).sort();
        const weekly: Record<string, any> = { labels: sortedLabels };
        for (const [key, map] of Object.entries(series)) {
            weekly[key] = sortedLabels.map(label => map.get(label) ?? 0);
        }

        return Result.ok({ totals, lastMonth, weekly, meta } as GetTeamMetricsOutputDTO);
    }
}
