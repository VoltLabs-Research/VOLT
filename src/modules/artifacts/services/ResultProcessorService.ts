import { AnalysisExposureDefinition, type AnalysisJobExecutionData } from '@/shared/contracts';
import { logger } from '@/core/logger';
import type { MinioService } from '@/modules/platform/services';
import type { PluginListingRepository } from '../repositories/PluginListingRepository';
import type { ExportNodeProcessorService } from './ExportNodeProcessorService';
import { Decoder } from '@msgpack/msgpack';
import { isRecord } from '@/shared/utils';
import mergeChunkedValue from '@/shared/utilities/merge-chunked-value';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';

const PLUGINS_BUCKET = 'volt-plugins';

/** Keys to keep during listing-only decode pass. */
const LISTING_KEYS = new Set(['main_listing', 'sub_listings']);

/** Keys to keep during export-only decode pass. */
const EXPORT_KEY_PREFIX = 'export';

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

const cleanSubListingRows = (rawRows: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
    if (rawRows.length === 0) {
        return [];
    }

    const firstRow = rawRows[0];
    const validKeys = Object.keys(firstRow).filter((key) => !shouldIgnoreValue(firstRow[key]));

    return rawRows.map((rawRow) => {
        const cleaned: Record<string, unknown> = {};
        for (const key of validKeys) {
            cleaned[key] = rawRow[key];
        }

        return cleaned;
    });
};

const mergeSelectiveChunk = (
    target: Record<string, unknown> | null,
    incoming: unknown,
    keyFilter: (key: string) => boolean
): Record<string, unknown> | null => {
    if (!isRecord(incoming)) {
        return target;
    }

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(incoming)) {
        if (keyFilter(key)) {
            filtered[key] = value;
        }
    }

    if (Object.keys(filtered).length === 0) {
        return target;
    }

    const merged = mergeChunkedValue(target, filtered);
    return isRecord(merged) ? merged : target;
};

async function* decodeMultiStream(src: AsyncIterable<Uint8Array | Buffer>): AsyncIterable<unknown> {
    const decoder = new Decoder<unknown>();
    const byteSrc = (async function* () {
        for await (const chunk of src) {
            yield chunk;
        }
    })();

    for await (const value of decoder.decodeStream(byteSrc)) {
        yield value;
    }
}

/**
 * PASS 1 — Listing decode.
 * Streams the msgpack file and only materializes `main_listing` and `sub_listings`.
 * All other keys (export data, per-atom-properties, etc.) are discarded during decode,
 * so they never occupy heap space.
 */
async function readListingPayload(filePath: string): Promise<Record<string, unknown> | null> {
    const stream = createReadStream(filePath) as unknown as Readable;
    const asyncIterable = (async function* () {
        for await (const chunk of stream) {
            yield chunk as Uint8Array | Buffer;
        }
    })();

    let decoded: Record<string, unknown> | null = null;
    for await (const message of decodeMultiStream(asyncIterable)) {
        decoded = mergeSelectiveChunk(decoded, message, (key) => LISTING_KEYS.has(key));
    }

    return decoded;
}

/**
 * PASS 2 — Export decode.
 * Streams the msgpack file and only materializes the `export` key.
 * Listing data and per-atom-properties are discarded.
 */
async function readExportPayload(filePath: string): Promise<Record<string, unknown> | null> {
    const stream = createReadStream(filePath) as unknown as Readable;
    const asyncIterable = (async function* () {
        for await (const chunk of stream) {
            yield chunk as Uint8Array | Buffer;
        }
    })();

    let decoded: Record<string, unknown> | null = null;
    for await (const message of decodeMultiStream(asyncIterable)) {
        decoded = mergeSelectiveChunk(decoded, message, (key) => key === EXPORT_KEY_PREFIX || key.startsWith(`${EXPORT_KEY_PREFIX}.`));
    }

    return decoded;
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

        // ── PASS 1: Decode only listing keys ──────────────────────────────
        logMemoryUsage('before-listing-decode');
        const listingPayload = await readListingPayload(outputFilePath);
        logMemoryUsage('after-listing-decode');

        await precomputeListingRows(pluginListingRepository, executionData, exposure, listingPayload, storageKey, timestep, teamId);

        // Release listing data explicitly before export pass
        // (listingPayload becomes unreachable and eligible for GC)

        // ── PASS 2: Decode only export key (if needed) ───────────────────
        if (exposure.export) {
            logMemoryUsage('before-export-decode');
            const exportPayload = await readExportPayload(outputFilePath);
            logMemoryUsage('after-export-decode');

            if (exportPayload) {
                await exportNodeProcessorService.process({
                    executionData,
                    exposure,
                    decodedPayload: exportPayload,
                    timestep,
                    teamClusterId: executionData.teamClusterId || ''
                });
                logMemoryUsage('after-export-processing');
            }
        }

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

    for (const [subListingName, rawRows] of Object.entries(subListings)) {
        const cleanedRows = cleanSubListingRows(rawRows);
        if (cleanedRows.length === 0) {
            continue;
        }

        const documents = cleanedRows.map((cleanedRow) => ({
            plugin: executionData.pluginId,
            team: teamId,
            trajectory: executionData.trajectoryId,
            analysis: executionData.analysisId,
            exposureId: exposure.nodeId,
            exposureName: exposure.name,
            timestep,
            subListingName,
            row: cleanedRow
        }));

        await pluginListingRepository.insertSubListingRows(documents);
    }

    logger.info(
        {
            exposure: exposure.name,
            timestep,
            subListingCount: subListingNames.length
        },
        'Listing rows precomputed'
    );
}
