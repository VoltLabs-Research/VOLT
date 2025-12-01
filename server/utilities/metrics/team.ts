/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { Trajectory } from '@models/index';
import Analysis from '@/models/analysis';
import MongoListingCountAggregator from '@/services/metrics/mongo-listing-count-aggregator';
import ManifestService from '@/services/plugins/manifest-service';

export const getMetricsByTeamId = async (teamId: string) => {
    const trajectories = await Trajectory.find({ team: teamId }).select('_id').lean();
    if (!trajectories.length) {
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
        .select('_id plugin modifier trajectory')
        .lean();

    const pluginsByModifier = new Map<string, Set<string>>();
    const pluginPointers = new Map<string, Map<string, { trajectoryId: string; analysisId: string }>>();
    const pluginModifierAnalyses = new Map<string, Map<string, Array<{ trajectoryId: string; analysisId: string; createdAt?: string }>>>();

    for (const analysis of analyses) {
        if (!analysis.plugin || !analysis.modifier) continue;
        const pluginKey = String(analysis.plugin);
        const modifierKey = String(analysis.modifier);
        const trajectoryKey = (analysis.trajectory as any)?.toString?.() ?? String(analysis.trajectory ?? '');
        const analysisKey = analysis._id?.toString?.() ?? '';
        if (!trajectoryKey || !analysisKey) continue;

        if (!pluginsByModifier.has(pluginKey)) {
            pluginsByModifier.set(pluginKey, new Set());
        }
        pluginsByModifier.get(pluginKey)!.add(modifierKey);

        const pointerMap = pluginPointers.get(pluginKey) ?? new Map<string, { trajectoryId: string; analysisId: string }>();
        if (!pointerMap.has(modifierKey)) {
            pointerMap.set(modifierKey, { trajectoryId: trajectoryKey, analysisId: analysisKey });
        }
        pluginPointers.set(pluginKey, pointerMap);

        const analysisMap =
            pluginModifierAnalyses.get(pluginKey) ??
            new Map<string, Array<{ trajectoryId: string; analysisId: string; createdAt?: string }>>();
        const arr = analysisMap.get(modifierKey) ?? [];
        arr.push({
            trajectoryId: trajectoryKey,
            analysisId: analysisKey,
            createdAt: analysis.createdAt ? new Date(analysis.createdAt).toISOString() : undefined
        });
        analysisMap.set(modifierKey, arr);
        pluginModifierAnalyses.set(pluginKey, analysisMap);
    }

    for (const [pluginId, modifiers] of pluginsByModifier.entries()) {
        const manifest = await new ManifestService(pluginId).get();
        const listingEntries = manifest.listing ?? {};
        const listingKeys = Object.keys(listingEntries).filter((key) => {
            const entry = listingEntries[key];
            if (!entry?.aggregators?.count) return false;

            if (entry.modifiers && Array.isArray(entry.modifiers)) {
                return entry.modifiers.some((modId: string) => modifiers.has(modId));
            }

            const modifierId = key.split('_')[0];
            return modifiers.has(modifierId);
        });

        for (const listingKey of listingKeys) {
            const entry = listingEntries[listingKey];

            // Determine which modifiers contribute to this listing
            let relevantModifiers: string[] = [];
            if (entry.modifiers && Array.isArray(entry.modifiers)) {
                relevantModifiers = entry.modifiers;
            } else {
                relevantModifiers = [listingKey.split('_')[0]];
            }

            // Collect all analysis pointers for these modifiers
            const analysisPointers: Array<{ trajectoryId: string; analysisId: string; createdAt?: string }> = [];
            let firstPointer: { trajectoryId: string; analysisId: string } | undefined;

            for (const modId of relevantModifiers) {
                const pointers = pluginModifierAnalyses.get(pluginId)?.get(modId);
                if (pointers) {
                    analysisPointers.push(...pointers);
                    if (!firstPointer && pointers.length > 0) {
                        firstPointer = { trajectoryId: pointers[0].trajectoryId, analysisId: pointers[0].analysisId };
                    }
                }
            }

            const listingUrl = firstPointer
                ? `/dashboard/trajectory/${firstPointer.trajectoryId}/plugin/${pluginId}/listing/${listingKey}`
                : undefined;

            if (!analysisPointers.length) {
                continue;
            }

            aggregators.push({
                agg: new MongoListingCountAggregator(
                    {
                        kind: 'listing',
                        listingKey,
                        pluginId,
                        displayName: entry?.aggregators?.displayName ?? listingKey,
                        listingUrl,
                        analysisPointers
                    },
                    { metricKey: listingKey }
                ),
                key: listingKey
            });
        }
    }

    return MongoListingCountAggregator.merge(aggregators);
};