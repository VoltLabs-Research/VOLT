import { Plugin, Trajectory } from '@models/index';
import Analysis from '@/models/trajectory/analysis';
import MongoListingCountAggregator from '@/services/metrics/mongo-listing-count-aggregator';
import { IWorkflowNode, NodeType } from '@/types/models/modifier';

type Pointer = {
    trajectoryId: string;
    analysisId: string;
    createdAt?: string;
};

export const getMetricsByTeamId = async (teamId: string) => {
    console.log('get metrics by team id:', teamId);
    const trajectoryDocs = await Trajectory.find({ team: teamId }).select('_id').lean();
    if (!trajectoryDocs.length) {
        return { totals: {}, lastMonth: {}, weekly: { labels: [] } };
    }

    const trajectoryObjectIds = trajectoryDocs.map((traj) => traj._id);
    const trajectoryIdStr = new Map(trajectoryDocs.map((traj) => [String(traj._id), String(traj._id)]));

    const aggregators: Array<{ agg: MongoListingCountAggregator; key: string }> = [{
        agg: new MongoListingCountAggregator(
            { kind: 'model', model: Trajectory, buildQuery: () => ({ team: teamId }) },
            { metricKey: 'trajectories' }
        ),
        key: 'trajectories'
    }, {
        agg: new MongoListingCountAggregator(
            { kind: 'model', model: Analysis, buildQuery: () => ({ trajectory: { $in: trajectoryObjectIds } }) },
            { metricKey: 'analysis' }
        ),
        key: 'analysis'
    }];

    const analyses = await Analysis.find({ trajectory: { $in: trajectoryObjectIds } })
        .select('_id plugin modifier trajectory createdAt')
        .lean();

    const pointersByPlugin = new Map<string, Pointer[]>();
    for (const analysis of analyses) {
        if (!analysis.plugin || !analysis.trajectory) continue;
        const pluginSlug = String(analysis.plugin);
        const trajectoryId = String(analysis.trajectory);
        const analysisId = String(analysis._id);
        if (!trajectoryId || !analysisId) continue;

        const arr = pointersByPlugin.get(pluginSlug);
        const createdAt = (analysis as any).createdAt ? new Date((analysis as any).createdAt).toISOString() : undefined;
        if (arr) {
            arr.push({ trajectoryId, analysisId, createdAt });
        } else {
            pointersByPlugin.set(pluginSlug, [{ trajectoryId, analysisId, createdAt }]);
        }
    }

    const pluginSlugs = [...pointersByPlugin.keys()];
    if (!pluginSlugs.length) {
        return MongoListingCountAggregator.merge(aggregators);
    }

    const plugins = await Plugin.find({ slug: { $in: pluginSlugs } }).lean();
    const pluginBySlug = new Map(plugins.map((plugin) => [String(plugin.slug), plugin]));

    for (const slug of pluginSlugs) {
        const plugin = pluginBySlug.get(slug);
        if (!plugin) continue;

        const analysisPointers = pointersByPlugin.get(slug) ?? [];
        if (!analysisPointers.length) continue;

        const exposureNodes = plugin.workflow?.nodes?.filter((node: IWorkflowNode) => node.type === NodeType.EXPOSURE) ?? [];
        if (!exposureNodes.length) continue;

        const modifierNode = plugin.workflow?.nodes?.find((node: IWorkflowNode) => node.type === NodeType.MODIFIER);
        const pluginName = modifierNode?.data?.modifier?.name || slug;

        const first = analysisPointers[0];
        for (const exposureNode of exposureNodes) {
            const displayName = exposureNode.data?.exposure?.name || exposureNode.id;
            const listingKey = displayName;

            const listingUrl = first
                ? `/dashboard/trajectory/${first.trajectoryId}/plugin/${slug}/listing/${listingKey}`
                : undefined;
            aggregators.push({
                agg: new MongoListingCountAggregator({
                    kind: 'listing',
                    listingKey,
                    pluginId: slug,
                    pluginName,
                    displayName,
                    listingUrl,
                    analysisPointers
                }, { metricKey: listingKey }),
                key: listingKey
            });
        }
    }

    return MongoListingCountAggregator.merge(aggregators);
};
