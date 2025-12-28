/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Plugin, Trajectory } from '@models/index';
import Analysis from '@/models/analysis';
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

        const first = analysisPointers[0];
        for (const exposureNode of exposureNodes) {
            const listingKey = exposureNode.id;
            const displayName = exposureNode.data?.exposure?.name || exposureNode.id;
            const listingUrl = first
                ? `/dashboard/trajectory/${first.trajectoryId}/plugin/${slug}/listing/${listingKey}`
                : undefined;
            aggregators.push({
                agg: new MongoListingCountAggregator({
                    kind: 'listing',
                    listingKey,
                    pluginId: slug,
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
