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

import BaseListingAggregator, { AggregatorConfig } from '@/services/metrics/base-listing-aggregator';
import Plugin from '@/models/plugin';
import { NodeType } from '@/types/models/plugin';
import { Model } from 'mongoose';
import PluginListingRow from '@/models/plugin-listing-row';

export type ListingEntry = {
    aggregators?: {
        count?: boolean;
    }
};

type ModelMode = {
    kind: 'model';
    model: typeof Model;
    buildQuery(): Record<string, any>;
};

type ListingMode = {
    kind: 'listing';
    listingKey: string;
    pluginId: string;
    pluginName?: string;
    displayName?: string;
    listingUrl?: string;
    analysisPointers: Array<{
        analysisId: string;
        trajectoryId: string;
        createdAt?: string;
    }>;
};

type AggregatorMode = ModelMode | ListingMode;

export type ListingMetrics = {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
    meta?: Record<string, { displayName?: string; listingUrl?: string; pluginName?: string }>;

};

export default class MongoListingCountAggregator extends BaseListingAggregator {
    private totals = 0;
    private currMonth = 0;
    private prevMonth = 0;
    private weeklyCounts = new Map<string, number>();

    constructor(
        private mode: AggregatorMode,
        config?: AggregatorConfig
    ) {
        super(config);
    }

    private async getListingDefinition() {
        if (this.mode.kind !== 'listing') return null;

        const plugin = await Plugin.findOne({ slug: this.mode.pluginId });
        if (!plugin) {
            return null;
        }

        // Find the exposure node matching the listing key(TODO: workflow-utils)
        const exposureNode = plugin.workflow.nodes.find((node: any) =>
            node.type === NodeType.EXPOSURE && node.data?.exposure?.name === (this.mode as any).listingKey);

        if (!exposureNode) return null;
        // The "listingSlug" in PluginListingRow is actually the exposure name (case-sensitive)
        const exposureSlug = this.mode.listingKey;

        return { exposureSlug, pluginId: plugin._id };
    }

    private updateBuckets(createdAt: Date) {
        this.totals += 1;

        if (createdAt >= this.monthStart && createdAt < this.now) {
            this.currMonth += 1;
        } else if (createdAt >= this.prevMonthStart && createdAt < this.monthStart) {
            this.prevMonth += 1;
        }

        if (createdAt >= this.sinceDate) {
            const key = this.toWeekKey(createdAt);
            this.weeklyCounts.set(key, (this.weeklyCounts.get(key) ?? 0) + 1);
        }
    }

    private async collectFromModel() {
        if (this.mode.kind !== 'model') {
            throw new Error('collectFromModel() only if kind === "model"');
        }

        const query = this.mode.buildQuery();
        const cursor = this.mode.model.find(query).select('createdAt').cursor();
        for await (const doc of cursor as any) {
            const createdAt = (doc as any)?.createdAt as Date | undefined;
            if (createdAt) {
                this.updateBuckets(createdAt);
            }
        }
    }

    private async collectFromListing() {
        if (this.mode.kind !== 'listing') {
            throw new Error('collectFromListing() only if kind === "listing"');
        }

        if (!this.mode.analysisPointers?.length) {
            return;
        }

        const definition = await this.getListingDefinition();
        if (!definition) {
            return;
        }

        const analysisIds = this.mode.analysisPointers.map(p => p.analysisId);

        const query = {
            plugin: definition.pluginId,
            listingSlug: definition.exposureSlug,
            analysis: { $in: analysisIds }
        };
        const cursor = PluginListingRow.find(query).select('createdAt').cursor();

        for await (const doc of cursor) {
            this.updateBuckets(doc.createdAt);
        }
    }

    async collect(metricKey?: string) {
        if (this.mode.kind === 'model') {
            await this.collectFromModel();
        } else {
            await this.collectFromListing();
        }

        const labels = Array.from(this.weeklyCounts.keys()).sort().slice(-this.weeks);
        const weeklySeries = labels.map((week) => this.weeklyCounts.get(week) ?? 0);

        const finalMetricKey = metricKey ?? this.metricKey;
        const metaEntry = this.mode.kind === 'listing'
            ? {
                [finalMetricKey]: {
                    displayName: this.mode.displayName,
                    listingUrl: this.mode.listingUrl,
                    pluginName: this.mode.pluginName
                }
            }
            : {};

        return {
            totals: { [finalMetricKey]: this.totals },
            lastMonth: { [finalMetricKey]: this.pct(this.currMonth, this.prevMonth) },
            weekly: {
                labels,
                [finalMetricKey]: weeklySeries
            },
            meta: metaEntry
        };
    }

    static async merge(aggregators: Array<{ agg: MongoListingCountAggregator; key: string }>): Promise<ListingMetrics> {
        const totals: Record<string, number> = {};
        const lastMonth: Record<string, number> = {};
        const labelsSet = new Set<string>();
        const series: Record<string, Map<string, number>> = {};

        const mergeTotals = (source: Record<string, number>) => {
            for (const [key, value] of Object.entries(source)) {
                totals[key] = (totals[key] ?? 0) + value;
            }
        };

        const mergeLastMonth = (source: Record<string, number>) => {
            for (const [key, value] of Object.entries(source)) {
                lastMonth[key] = (lastMonth[key] ?? 0) + value;
            }
        };

        const meta: Record<string, { displayName?: string; listingUrl?: string; pluginName?: string }> = {};
        for (const { agg, key } of aggregators) {
            const metrics = await agg.collect(key);
            mergeTotals(metrics.totals);
            mergeLastMonth(metrics.lastMonth);

            if (metrics.meta) {
                Object.assign(meta, metrics.meta);
            }

            const map = series[key] ?? new Map<string, number>();
            const labels = metrics.weekly.labels ?? [];
            const values = metrics.weekly[key] as number[] ?? [];

            labels.forEach((label, idx) => {
                labelsSet.add(label);
                map.set(label, (map.get(label) ?? 0) + (values[idx] ?? 0));
            });

            series[key] = map;
        }

        const sortedLabels = Array.from(labelsSet).sort();
        const weekly: ListingMetrics['weekly'] = { labels: sortedLabels };
        for (const [key, map] of Object.entries(series)) {
            weekly[key] = sortedLabels.map((label) => map.get(label) ?? 0);
        }

        return {
            totals,
            lastMonth,
            weekly,
            meta
        };
    }
};
