import { Response } from 'express';
import { SYS_BUCKETS } from '@/config/minio';
import { decodeMultiStream } from '@/utilities/msgpack/msgpack-stream';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeType } from '@/types/models/plugin';
import { slugify } from '@/utilities/runtime/runtime';
import { Analysis, PluginListingRow } from '@/models';
import Plugin from '@/models/plugin/plugin';
import storage from '@/services/storage';
import logger from '@/logger';
import AtomProperties from '@/services/trajectory/atoms/atom-properties';
import { asyncForEach } from '@/utilities/runtime/async-loop';

export interface ListingQueryParams {
    pluginSlug: string;
    listingSlug: string;
    teamId?: string;
    trajectoryId?: string;
    limit?: number;
    sortAsc?: boolean;
    afterCursor?: string;
}

export interface ListingResult {
    meta: { pluginSlug: string; listingSlug: string; columns?: { path: string; label: string }[] };
    rows: any[];
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
}

export interface PerFrameListingParams {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: string;
    page?: number;
    limit?: number;
}

export interface PerFrameListingResult {
    rows: any[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

const RESERVED_KEYS = new Set([
    '_id',
    'timestep',
    'analysisId',
    'trajectoryId',
    'exposureId',
    'trajectoryName'
]);

class PluginListingService {
    private readonly atomProps: AtomProperties;

    constructor() {
        this.atomProps = new AtomProperties();
    }

    async getListingDocuments(params: ListingQueryParams): Promise<ListingResult> {
        const { pluginSlug, listingSlug, teamId, trajectoryId } = params;
        const limit = Math.min(200, Math.max(1, params.limit || 50));
        const sortAsc = params.sortAsc || false;

        let afterTimestep: number | null = null;
        let afterId: string | null = null;

        if (params.afterCursor?.includes(':')) {
            const [timestep, id] = params.afterCursor.split(':');
            afterTimestep = Number(timestep);
            afterId = id;
        }

        const plugin = await Plugin.findOne({ slug: pluginSlug }).select('_id').lean();
        if (!plugin) throw new Error('Plugin::NotFound');

        const base: any = {
            plugin: plugin._id,
            listingSlug,
            team: teamId
        };

        if (trajectoryId) {
            base.trajectory = trajectoryId;
        } else if (!teamId) {
            throw new Error('Team::IdRequired');
        }

        if (afterTimestep != null && afterId) {
            base.$or = sortAsc
                ? [
                    { timestep: { $gt: afterTimestep } },
                    { timestep: afterTimestep, _id: { $gt: afterId } }
                ]
                : [
                    { timestep: { $lt: afterTimestep } },
                    { timestep: afterTimestep, _id: { $lt: afterId } }
                ];
        }

        const docs = await PluginListingRow.find(base)
            .select('timestep analysis trajectory trajectoryName exposureId row')
            .sort({ timestep: sortAsc ? 1 : -1, _id: sortAsc ? 1 : -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = docs.length > limit;
        const slice = hasMore ? docs.slice(0, limit) : docs;

        const rawRows = slice.map((doc: any) => ({
            _id: String(doc._id),
            timestep: doc.timestep,
            analysisId: String(doc.analysis),
            trajectoryId: String(doc.trajectory),
            exposureId: doc.exposureId,
            trajectoryName: doc.trajectoryName,
            ...(doc.row || {})
        }));

        const rows = rawRows.map((r: any) => {
            const fixed: Record<string, any> = {
                _id: r._id,
                timestep: r.timestep,
                analysisId: r.analysisId,
                trajectoryId: r.trajectoryId,
                exposureId: r.exposureId,
                trajectoryName: r.trajectoryName
            };

            const rest = { ...r };
            for (const k of Object.keys(fixed)) delete rest[k];

            return { ...fixed, ...rest };
        });

        const seen = new Set<string>();
        const ordered: string[] = [];
        const nonNull = new Set<string>();

        await asyncForEach(rows, 100, async (r) => {
            for (const [k, v] of Object.entries(r)) {
                if (RESERVED_KEYS.has(k)) return;
                if (v === null || v === undefined) return;
                nonNull.add(k);
                if (!seen.has(k)) {
                    seen.add(k);
                    ordered.push(k);
                }
            }
        });

        const columns = ordered
            .filter((k) => nonNull.has(k))
            .map((k) => ({ path: k, label: k }));

        const nextCursor = hasMore
            ? `${slice[slice.length - 1].timestep}:${slice[slice.length - 1]._id}`
            : null;

        return {
            meta: { pluginSlug, listingSlug, columns },
            rows,
            limit,
            hasMore,
            nextCursor
        };
    }

    async getPerFrameListing(params: PerFrameListingParams): Promise<PerFrameListingResult> {
        const { trajectoryId, analysisId, exposureId, timestep } = params;
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(1000, Math.max(1, params.limit || 50));

        const config = await this.atomProps.getExposureAtomConfig(analysisId, exposureId);
        const iterableKey = config.iterableKey;

        const objectName = [
            'plugins',
            `trajectory-${trajectoryId}`,
            `analysis-${analysisId}`,
            exposureId,
            `timestep-${timestep}.msgpack`
        ].join('/');

        const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, objectName);
        const offset = (page - 1) * limit;

        let total = 0;
        let pagedItems: any[] = [];

        const resolveIterable = (payload: any): any[] => {
            if (Array.isArray(payload)) return payload;
            if (iterableKey && payload?.[iterableKey] && Array.isArray(payload[iterableKey])) {
                return payload[iterableKey];
            }
            if (payload?.data && Array.isArray(payload.data)) return payload.data;
            for (const key in payload) {
                if (Array.isArray(payload[key])) return payload[key];
            }
            return [];
        };

        for await (const msg of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
            const items = resolveIterable(msg as any);
            if (!items.length) continue;

            const chunkStart = total;
            const chunkEnd = total + items.length;
            total = chunkEnd;

            if (pagedItems.length < limit && chunkEnd > offset) {
                const start = Math.max(0, offset - chunkStart);
                const remaining = limit - pagedItems.length;
                const end = Math.min(items.length, start + remaining);
                if (start < end) {
                    pagedItems = pagedItems.concat(items.slice(start, end));
                }
            }
        }

        return {
            rows: pagedItems,
            page,
            limit,
            total,
            hasMore: offset + pagedItems.length < total
        };
    }

    async streamExposureGLB(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        res: Response
    ): Promise<void> {
        const exposureKey = slugify(exposureId);
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/${exposureKey}.glb`;

        const stat = await storage.getStat(SYS_BUCKETS.MODELS, objectName);
        const stream = await storage.getStream(SYS_BUCKETS.MODELS, objectName);

        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${exposureId}_${timestep}.glb"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        stream.pipe(res);
    }

    async streamExposureChart(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        res: Response
    ): Promise<void> {
        const exposureKey = slugify(exposureId);
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/charts/${timestep}/${exposureKey}.png`;

        const stat = await storage.getStat(SYS_BUCKETS.PLUGINS, objectName);
        const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, objectName);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${exposureId}_${timestep}.png"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        stream.pipe(res);
    }

    async streamExposureFile(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        filename: string,
        res: Response
    ): Promise<void> {
        const objectName = [
            'plugins',
            `trajectory-${trajectoryId}`,
            `analysis-${analysisId}`,
            exposureId,
            `timestep-${timestep}.msgpack`
        ].join('/');

        const stat = await storage.getStat(SYS_BUCKETS.PLUGINS, objectName);
        const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, objectName);

        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        if (filename.endsWith('.msgpack')) {
            res.setHeader('Content-Type', 'application/x-msgpack');
        } else if (filename.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        } else {
            res.setHeader('Content-Type', 'application/octet-stream');
        }

        stream.pipe(res);
    }

    async exportAnalysisResults(
        pluginSlug: string,
        analysisId: string,
        res: Response
    ): Promise<void> {
        // Validate plugin existence first
        const plugin = await Plugin.findOne({ slug: pluginSlug });
        if (!plugin) throw new Error('Plugin::NotFound');

        // Look for valid listing exposures
        const exposures = (plugin.exposures || []).filter(e => e.name);
        const hasAtoms = (plugin.exposures || []).some(e => e.perAtomProperties && e.perAtomProperties.length > 0);

        if (exposures.length === 0 && !hasAtoms) {
            throw new Error('Plugin::NoExposuresToExport');
        }

        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });

        res.attachment(`${pluginSlug}_analysis_${analysisId}.zip`);

        // Handle stream errors
        archive.on('error', (err: any) => {
            logger.error(`[ExportAnalysis] Archive error: ${err}`);
            if (!res.headersSent) {
                res.status(500).send({ error: 'Archive generation failed' });
            } else {
                res.end();
            }
        });

        res.on('close', () => {
            logger.info('[ExportAnalysis] Response stream closed');
            archive.abort();
        });

        archive.pipe(res);

        // Helper to process an exposure and append to zip
        const processExposure = async (listingSlug: string, exposureId: string, isAtoms: boolean = false) => {
            const baseQuery: any = {
                plugin: plugin._id,
                analysis: analysisId,
                exposureId: exposureId
            };

            const distinctTimesteps = await PluginListingRow.distinct('timestep', baseQuery);
            distinctTimesteps.sort((a, b) => a - b);

            if (distinctTimesteps.length === 0) return;

            // Create a simple string buffer/stream for the CSV content
            // We'll write to a manually managed PassThrough to allow async writing
            const { PassThrough } = require('stream');
            const jsonStream = new PassThrough();

            archive.append(jsonStream, { name: `${isAtoms ? 'Atoms' : listingSlug}.json` });

            let isFirstItem = true;
            jsonStream.write('[\n');

            // Find trajectoryId once
            let trajectoryId = '';
            const sample = await PluginListingRow.findOne(baseQuery).select('trajectory');
            if (sample) trajectoryId = String(sample.trajectory);

            if (!trajectoryId) {
                jsonStream.write(']');
                jsonStream.end();
                return;
            }

            // Iterate timesteps
            for (const timestep of distinctTimesteps) {
                try {
                    const items = await this.getPerFrameListing({
                        trajectoryId,
                        analysisId,
                        exposureId,
                        timestep: String(timestep),
                        limit: 1000000
                    });

                    if (items.rows.length === 0) continue;

                    // Write Rows
                    for (const row of items.rows) {
                        const prefix = isFirstItem ? '  ' : ',\n  ';
                        jsonStream.write(prefix + JSON.stringify(row));
                        isFirstItem = false;
                    }
                } catch (err) {
                    logger.error(`[ExportAnalysis] Error processing timestep ${timestep}: ${err}`);
                }
            }

            jsonStream.write('\n]');
            jsonStream.end();
        };

        try {
            // Process configured exposures
            for (const exp of exposures) {
                await processExposure(exp.name, exp._id); // Use _id as per virtual
            }

            // Process atoms if present
            if (hasAtoms) {
                const atomExp = (plugin.exposures || []).find(e => e.perAtomProperties && e.perAtomProperties.length > 0);
                if (atomExp) {
                    await processExposure('Atoms', atomExp._id, true);
                }
            }

            // Export raw listing rows
            await this.exportListingRows(plugin._id, analysisId, archive);

            await archive.finalize();
        } catch (err) {
            logger.error(`[ExportAnalysis] Processing failed: ${err}`);
            archive.abort();
            throw err;
        }
    }

    private async exportListingRows(
        pluginId: any,
        analysisId: string,
        archive: any
    ): Promise<void> {
        const distinctSlugs = await PluginListingRow.distinct('listingSlug', {
            plugin: pluginId,
            analysis: analysisId
        });

        if (!distinctSlugs || distinctSlugs.length === 0) return;

        const { PassThrough } = require('stream');

        for (const slug of distinctSlugs) {
            const stream = new PassThrough();
            archive.append(stream, { name: `listing_rows/${slug}.json` });

            stream.write('[\n');
            let isFirst = true;

            const cursor = PluginListingRow.find({
                plugin: pluginId,
                analysis: analysisId,
                listingSlug: slug
            }).cursor();

            for await (const doc of cursor) {
                const prefix = isFirst ? '  ' : ',\n  ';
                stream.write(prefix + JSON.stringify(doc));
                isFirst = false;
            }

            stream.write('\n]');
            stream.end();
        }
    }
}

export default new PluginListingService();
