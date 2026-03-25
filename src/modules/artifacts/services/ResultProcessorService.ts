import { AnalysisExposureDefinition, type AnalysisJobExecutionData } from '@/shared/contracts';
import { logger } from '@/core/logger';
import { forceGC } from '@/core/memory';
import { isRecord } from '@/shared/utils';
import type { PluginListingRepository } from '../repositories/PluginListingRepository';
import type { ExportNodeProcessorService } from './ExportNodeProcessorService';
import { getRecommendedResultProcessingConcurrency } from '@/shared/utilities/analysis-resource-policy';
import { decodeMultiStream, mergeSelectiveChunk } from '@/shared/utilities/selective-msgpack';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { createScopedClusterObjectStore, type ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

const PLUGINS_BUCKET = 'volt-plugins';

/** Keys to keep during listing-only decode pass. */
const LISTING_KEYS = new Set(['main_listing']);

/** Keys to keep during export-only decode pass. */
const EXPORT_KEY_PREFIX = 'export';
const EXPOSURE_RESULT_PROCESSING_CONCURRENCY = getRecommendedResultProcessingConcurrency();

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

const cleanListingRow = (value: Record<string, unknown>): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value)) {
        if (!shouldIgnoreValue(entryValue)) {
            cleaned[key] = entryValue;
        }
    }

    return cleaned;
};

interface AsyncConcurrencyLimiter {
    run<T>(
        task: () => Promise<T>,
        context?: Record<string, unknown>
    ): Promise<T>;
}

const createAsyncConcurrencyLimiter = (concurrency: number): AsyncConcurrencyLimiter => {
    let activeCount = 0;
    const waitQueue: Array<() => void> = [];

    const acquire = async (): Promise<number> => {
        const queuedAt = Date.now();
        if (activeCount >= concurrency) {
            await new Promise<void>((resolve) => {
                waitQueue.push(resolve);
            });
        }

        activeCount += 1;
        return Date.now() - queuedAt;
    };

    const release = (): void => {
        activeCount = Math.max(0, activeCount - 1);
        const next = waitQueue.shift();
        if (next) {
            next();
        }
    };

    return {
        async run(task, context = {}) {
            const waitMs = await acquire();
            if (waitMs >= 250) {
                logger.info(
                    {
                        ...context,
                        waitMs,
                        activeCount,
                        pending: waitQueue.length,
                        concurrency
                    },
                    'Exposure result processing waited for capacity'
                );
            }

            try {
                return await task();
            } finally {
                release();
            }
        }
    };
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
    subListingNames: string[];
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
    const subListingNames = new Set<string>();

    for await (const message of decodeMultiStream(asyncIterable)) {
        listing = mergeSelectiveChunk(listing, message, (key) => LISTING_KEYS.has(key));
        exportData = mergeSelectiveChunk(exportData, message, (key) => key === EXPORT_KEY_PREFIX || key.startsWith(`${EXPORT_KEY_PREFIX}.`));

        if (!isRecord(message) || !isRecord(message.sub_listings)) {
            continue;
        }

        for (const [name, value] of Object.entries(message.sub_listings)) {
            if (Array.isArray(value) && value.length > 0) {
                if (value.some(isRecord)) {
                    subListingNames.add(name);
                }
                continue;
            }

            if (isRecord(value) && Object.keys(value).length > 0) {
                subListingNames.add(name);
            }
        }
    }

    return {
        listing,
        subListingNames: Array.from(subListingNames),
        exportData
    };
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
    objectStore: ClusterObjectStore,
    pluginListingRepository: PluginListingRepository,
    exportNodeProcessorService: ExportNodeProcessorService
): ResultProcessorService => {
    logger.info(
        {
            concurrency: EXPOSURE_RESULT_PROCESSING_CONCURRENCY
        },
        'Configured exposure result processing concurrency'
    );

    const exposureProcessingLimiter = createAsyncConcurrencyLimiter(
        EXPOSURE_RESULT_PROCESSING_CONCURRENCY
    );

    return {
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
            const storageOwnerClusterId = executionData.storageClusterId;
            if (!storageOwnerClusterId) {
                throw new Error(`Missing storage owner cluster for analysis ${executionData.analysisId}`);
            }
            const scopedObjectStore = createScopedClusterObjectStore(objectStore, storageOwnerClusterId);

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

            await scopedObjectStore.putObjectStream({
                bucket: PLUGINS_BUCKET,
                objectKey: storageKey,
                stream: createReadStream(outputFilePath),
                size: fileStat.size,
                metadata: {
                    'Content-Type': 'application/msgpack'
                }
            });

            logger.info({ storageKey }, 'Uploaded exposure .msgpack');

            await exposureProcessingLimiter.run(
                async () => {
                    // ── Single-pass decode: listing + export in one read ──────────
                    logMemoryUsage('before-listing-decode');
                    let { listing: listingPayload, subListingNames, exportData: exportPayload } = await readPayload(outputFilePath);
                    logMemoryUsage('after-listing-decode');

                    // ── Process listings ──────────────────────────────────────────
                    await precomputeListingRows(
                        pluginListingRepository,
                        executionData,
                        exposure,
                        listingPayload,
                        subListingNames,
                        storageKey,
                        storageOwnerClusterId,
                        timestep,
                        teamId
                    );

                    // Release listing data explicitly — make it eligible for GC before
                    // the (potentially heavy) export processing begins.
                    listingPayload = null;
                    subListingNames = [];
                    forceGC();

                    // ── Process exports (if needed) ──────────────────────────────
                    if (exposure.export && exportPayload) {
                        logMemoryUsage('before-export-processing');
                        await exportNodeProcessorService.process({
                            executionData,
                            exposure,
                            decodedPayload: exportPayload,
                            timestep,
                            storageClusterId: storageOwnerClusterId
                        });
                        logMemoryUsage('after-export-processing');
                    }

                    // Release export data
                    exportPayload = null;
                    forceGC();
                },
                {
                    analysisId: executionData.analysisId,
                    exposure: exposure.name,
                    timestep
                }
            );

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
    };
};

async function precomputeListingRows(
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    decoded: Record<string, unknown> | null,
    subListingNames: string[],
    objectKey: string,
    payloadOwnerClusterId: string,
    timestep: number,
    teamId: string
): Promise<void> {
    if (!decoded) {
        logger.debug({ objectKey }, 'Exposure output has no listing payload');
        return;
    }

    const mainListing = decoded.main_listing;
    if (!isRecord(mainListing) || Object.keys(mainListing).length === 0) {
        logger.warn({ objectKey }, 'Empty or missing main_listing in decoded payload');
        return;
    }

    const cleanedMainListing = cleanListingRow(mainListing);
    if (Object.keys(cleanedMainListing).length === 0) {
        logger.warn({ objectKey }, 'main_listing only contained filtered values, skipping persistence');
        return;
    }

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
            row: cleanedMainListing,
            payloadObjectKey: objectKey,
            payloadOwnerClusterId,
            subListingNames
        }
    }]);

    logger.info(
        {
            exposure: exposure.name,
            timestep,
            subListingCount: subListingNames.length
        },
        'Listing rows precomputed'
    );
}
