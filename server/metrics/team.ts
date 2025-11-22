/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { Trajectory } from '@models/index';
import Analysis from '@/models/analysis';
import MongoListingCountAggregator from '@/services/metrics/mongo-listing-count-aggregator';
import ManifestService from '@/services/plugins/manifest-service';

export const getMetricsByTeamId = async (teamId: string) => {
    const trajectories = await Trajectory.find({ team: teamId }).select('_id').lean();
    if(!trajectories.length){
        return { totals: {}, lastMonth: {}, weekly: { labels: [] } };
    }

    const trajectoryIds = trajectories.map((traj) => traj._id.toString());
    const aggregators: Array<{ agg: MongoListingCountAggregator; key: string }> = [
        {
            agg: new MongoListingCountAggregator(
                { kind: 'model', model: Trajectory, buildQuery: () => ({ team: teamId }) },
                { metricKey: 'trajectories' }
            ),
            key: 'trajectories'
        },
        {
            agg: new MongoListingCountAggregator(
                { kind: 'model', model: Analysis, buildQuery: () => ({ trajectory: { $in: trajectoryIds } }) },
                { metricKey: 'analysis' }
            ),
            key: 'analysis'
        }
    ];

    const analyses = await Analysis.find({ trajectory: { $in: trajectoryIds } })
        .select('plugin modifier')
        .lean();
    
    const pluginsByModifier = new Map<string, Set<string>>();
    for(const analysis of analyses){
        if(!analysis.plugin || !analysis.modifier) continue;
        if(!pluginsByModifier.has(analysis.plugin)){
            pluginsByModifier.set(analysis.plugin, new Set());
        }
        pluginsByModifier.get(analysis.plugin)!.add(analysis.modifier);
    }

    for(const [pluginId, modifiers] of pluginsByModifier.entries()){
        const manifest = await new ManifestService(pluginId).get();
        const listingEntries = manifest.listing ?? {};
        const listingKeys = Object.keys(listingEntries).filter((key) => {
            const entry = listingEntries[key];
            if(!entry?.aggregators?.count) return false;
            const modifierId = key.split('_')[0];
            return modifiers.has(modifierId);
        });
        
        for(const listingKey of listingKeys){
            const entry = listingEntries[listingKey];
            aggregators.push({
                agg: new MongoListingCountAggregator(
                    {
                        kind: 'listing',
                        listingKey,
                        pluginId,
                        displayName: entry?.aggregators?.displayName ?? listingKey
                    },
                    { metricKey: listingKey }
                ),
                key: listingKey
            });
        }
    }

    return MongoListingCountAggregator.merge(aggregators);
};