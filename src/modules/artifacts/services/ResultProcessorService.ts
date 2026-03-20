import { AnalysisExposureDefinition, type AnalysisJobExecutionData } from '@/shared/contracts';
import { logger } from '@/core/logger';
import { forceGC } from '@/core/memory';
import type { MinioService } from '@/modules/platform/services';
import { isRecord } from '@/shared/utils';
import type { PluginListingRepository } from '../repositories/PluginListingRepository';
import type { ExportNodeProcessorService } from './ExportNodeProcessorService';
import { decodeMultiStream, mergeSelectiveChunk } from '@/shared/utilities/selective-msgpack';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';

const PLUGINS_BUCKET = 'volt-plugins';

/** Keys to keep during listing-only decode pass. */
const LISTING_KEYS = new Set(['main_listing', 'sub_listings']);

/** Keys to keep during export-only decode pass. */
const EXPORT_KEY_PREFIX = 'export';

/**
 * Maximum number of sub-listing documents to insert into MongoDB in a single
 * `insertMany` call.  Keeps peak memory bounded when sub-listings contain
 * hundreds of thousands of rows.
 */
const SUB_LISTING_BATCH_SIZE = 2_000;

const logMemoryUsage = (context: string): void => {
    const usage = process.memoryUsage();
    logger.info(
        {
            context,
            heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
            rssMB: Math.round(usage.rss / 1024 / 1024),
            externalMB: Math.round(usage.external / 1024 / 1024)
        },
        'Memory usage'
    );
};

const shouldIgnoreValue = (value: unknown): boolean => {
    return Array.isArray(value) && value.length >= 1 && Array.isArray(value[0]);
};

/**
 * Builds a single cleaned sub-listing document ready for MongoDB insertion,
 * filtering out columns whose first-row value is a nested array (large binary
 * data that should not be stored in listings).
 *
 * This replaces the old `cleanSubListingRows` which created a full copy of
 * every row — now we build the document wrapper and the cleaned row in one step,
 * eliminating the intermediate `cleanedRows` array entirely.
 */
const buildSubListingDocument = (
    rawRow: Record<string, unknown>,
    validKeys: string[],
    shared: Record<string, unknown>
): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};
    for (const key of validKeys) {
        cleaned[key] = rawRow[key];
    }
    return { ...shared, row: cleaned };
};

/**
 * Single-pass decode — reads the msgpack file ONCE, extracting both listing
 * keys (`main_listing`, `sub_listings`) and export keys (`export`/`export.*`)
 * in a single streaming pass.
 *
 * Previous implementation decoded the same file twice (once for listings, once
 * for exports), each time fully materializing every key before filtering.
 * This caused ~2x memory amplification since `@msgpack/msgpack`'s
 * `Decoder.decodeStream` materializes each top-level message as a complete JS
 * object before yielding — so "selective" filtering only discards keys *after*
 * they've already been allocated on the V8 heap.
 *
 * With a single pass we still pay the per-message materialization cost, but
 * only once instead of twice.  The returned `listing` and `exportData` are the
 * *only* surviving references; everything else from each decoded message is
 * eligible for GC as soon as the loop iteration completes.
 */
async function readPayload(filePath: string): Promise<{
    listing: Record<string, unknown> | null;
    exportData: Record<string, unknown> | null;
}> {
    const stream = createReadStream(filePath) as unknown as Readable;
    const asyncIterable = (async function* () {
        for await (const chunk of stream) {
            yield chunk as Uint8Array | Buffer;
        }
    })();

    let listing: Record<string, unknown> | null = null;
    let exportData: Record<string, unknown> | null = null;

    for await (const message of decodeMultiStream(asyncIterable)) {
        listing = mergeSelectiveChunk(listing, message, (key) => LISTING_KEYS.has(key));
        exportData = mergeSelectiveChunk(exportData, message, (key) => key === EXPORT_KEY_PREFIX || key.startsWith(`${EXPORT_KEY_PREFIX}.`));
    }

    return { listing, exportData };
}

export interface ResultProcessorService {
    processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string
    ): Promise<void>;
}

export const createResultProcessorService = (
    minioService: MinioService,
    pluginListingRepository: PluginListingRepository,
    exportNodeProcessorService: ExportNodeProcessorService
): ResultProcessorService => ({
    async processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string
    ): Promise<void> {
        const outputFilePath = `${outputDir}_${exposure.results}`;
        const startedAt = Date.now();

        try {
            await fs.access(outputFilePath);
        } catch {
            logger.warn(
                {
                    exposure: exposure.name,
                    path: outputFilePath
                },
                'Exposure output file not found, skipping'
            );
            return;
        }

        const storageKey = `plugins/trajectory-${executionData.trajectoryId}/analysis-${executionData.analysisId}/${exposure.nodeId}/timestep-${timestep}.msgpack`;
        const fileStat = await fs.stat(outputFilePath);

        logger.info(
            {
                analysisId: executionData.analysisId,
                exposure: exposure.name,
                outputFilePath,
                sizeBytes: fileStat.size,
                storageKey,
                timestep
            },
            'Uploading exposure output'
        );

        await minioService.putObjectStream({
            bucket: PLUGINS_BUCKET,
            objectKey: storageKey,
            stream: createReadStream(outputFilePath),
            size: fileStat.size,
            metadata: {
                'Content-Type': 'application/msgpack'
            }
        });

        logger.info({ storageKey }, 'Uploaded exposure .msgpack');

        // ── Single-pass decode: listing + export in one read ──────────
        logMemoryUsage('before-listing-decode');
        let { listing: listingPayload, exportData: exportPayload } = await readPayload(outputFilePath);
        logMemoryUsage('after-listing-decode');

        // ── Process listings ──────────────────────────────────────────
        await precomputeListingRows(pluginListingRepository, executionData, exposure, listingPayload, storageKey, timestep, teamId);

        // Release listing data explicitly — make it eligible for GC before
        // the (potentially heavy) export processing begins.
        listingPayload = null;
        forceGC();

        // ── Process exports (if needed) ──────────────────────────────
        if (exposure.export && exportPayload) {
            logMemoryUsage('before-export-processing');
            await exportNodeProcessorService.process({
                executionData,
                exposure,
                decodedPayload: exportPayload,
                timestep,
                teamClusterId: executionData.teamClusterId || ''
            });
            logMemoryUsage('after-export-processing');
        }

        // Release export data
        exportPayload = null;
        forceGC();

        logger.info(
            {
                analysisId: executionData.analysisId,
                exposure: exposure.name,
                durationMs: Date.now() - startedAt,
                storageKey,
                timestep
            },
            'Finished exposure result processing'
        );
    }
});

async function precomputeListingRows(
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    decoded: Record<string, unknown> | null,
    objectKey: string,
    timestep: number,
    teamId: string
): Promise<void> {
    if (!decoded) {
        logger.warn({ objectKey }, 'Failed to decode msgpack payload');
        return;
    }

    const mainListing = decoded.main_listing;
    if (!mainListing || typeof mainListing !== 'object' || Object.keys(mainListing).length === 0) {
        logger.warn({ objectKey }, 'Empty or missing main_listing in decoded payload');
        return;
    }

    await pluginListingRepository.deleteSubListingRows({
        analysis: executionData.analysisId,
        exposureId: exposure.nodeId,
        timestep
    });

    let subListings: Record<string, Array<Record<string, unknown>>> = {};
    const rawSubListings = decoded.sub_listings;
    if (rawSubListings && typeof rawSubListings === 'object') {
        const entries = Object.entries(rawSubListings);
        for (const [name, value] of entries) {
            if (Array.isArray(value) && value.length > 0) {
                subListings[name] = value.filter(isRecord);
            } else if (isRecord(value) && Object.keys(value).length > 0) {
                subListings[name] = [value];
            }
        }
    }

    const subListingNames = Object.keys(subListings);

    await pluginListingRepository.bulkUpsertListingRows([{
        filter: {
            analysis: executionData.analysisId,
            exposureId: exposure.nodeId,
            timestep
        },
        update: {
            plugin: executionData.pluginId,
            team: teamId,
            trajectory: executionData.trajectoryId,
            trajectoryName: '',
            analysis: executionData.analysisId,
            exposureName: exposure.name,
            exposureId: exposure.nodeId,
            timestep,
            row: mainListing,
            subListingNames
        }
    }]);

    // ── Batched sub-listing insertion ─────────────────────────────────
    // Instead of materializing ALL documents for a sub-listing at once
    // (which triples memory: rawRows + cleanedRows + document wrappers),
    // we iterate in fixed-size batches and insert each batch before
    // building the next one.  Only the current batch lives in memory.
    for (const [subListingName, rawRows] of Object.entries(subListings)) {
        if (rawRows.length === 0) continue;

        // Determine valid keys from the first row (same logic as before)
        const firstRow = rawRows[0];
        const validKeys = Object.keys(firstRow).filter((key) => !shouldIgnoreValue(firstRow[key]));
        if (validKeys.length === 0) continue;

        // Shared fields that are identical for every document in this sub-listing
        const sharedFields: Record<string, unknown> = {
            plugin: executionData.pluginId,
            team: teamId,
            trajectory: executionData.trajectoryId,
            analysis: executionData.analysisId,
            exposureId: exposure.nodeId,
            exposureName: exposure.name,
            timestep,
            subListingName
        };

        for (let offset = 0; offset < rawRows.length; offset += SUB_LISTING_BATCH_SIZE) {
            const end = Math.min(offset + SUB_LISTING_BATCH_SIZE, rawRows.length);
            const batch: Record<string, unknown>[] = [];

            for (let i = offset; i < end; i++) {
                batch.push(buildSubListingDocument(rawRows[i], validKeys, sharedFields));
            }

            await pluginListingRepository.insertSubListingRows(batch);
        }
    }

    // Release sub-listing references — the raw arrays from the decoded
    // msgpack can be very large and we no longer need them.
    subListings = {};

    logger.info(
        {
            exposure: exposure.name,
            timestep,
            subListingCount: subListingNames.length
        },
        'Listing rows precomputed'
    );
}
