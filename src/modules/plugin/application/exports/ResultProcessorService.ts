import Bottleneck from 'bottleneck';

import { logger } from '@/core/logger';
import { forceGC } from '@/core/memory';
import { ObjectBucketName } from '@/core/storage/contracts/http.objectStore';
import { isRecord } from '@/support/type-guards/isRecord';
import type { PluginListingRepository } from '@/modules/plugin/infrastructure/repositories/PluginListingRepository.contract';
import type { ExportNodeProcessorService } from '@/modules/plugin/application/exports/ExportNodeProcessorService';
import type { ArtifactUploadBatch } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService';
import { getRecommendedResultProcessingConcurrency } from '@/support/policies/analysis-resource-policy';
import { decodeMultiStream, mergeSelectiveChunk } from '@/support/serialization/selective-msgpack';
import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@/modules/analysis/contracts/http.analysis';
import type { ResultProcessorService } from '@/modules/plugin/application/exports/ResultProcessorService.contract';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';

interface PayloadRecord {
    [key: string]: unknown;
}

interface PayloadReadResult {
    listing: PayloadRecord | null;
    subListingNames: string[];
    exportData: PayloadRecord | null;
}

/** Keys to keep during listing-only decode pass. */
const LISTING_KEYS = new Set(['main_listing']);

/** Keys to keep during export-only decode pass. */
const EXPORT_KEY_PREFIX = 'export';
const EXPOSURE_RESULT_PROCESSING_CONCURRENCY = getRecommendedResultProcessingConcurrency();

async function readPayload(filePath: string): Promise<PayloadReadResult> {
    let listing: PayloadRecord | null = null;
    let exportData: PayloadRecord | null = null;
    const subListingNames = new Set<string>();

    for await (const message of decodeMultiStream(createReadStream(filePath))) {
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

export const createResultProcessorService = (
    pluginListingRepository: PluginListingRepository,
    exportNodeProcessorService: ExportNodeProcessorService
): ResultProcessorService => {
    logger.info(
        {
            concurrency: EXPOSURE_RESULT_PROCESSING_CONCURRENCY
        },
        'Configured exposure result processing concurrency'
    );

    const exposureProcessingLimiter = new Bottleneck({
        maxConcurrent: EXPOSURE_RESULT_PROCESSING_CONCURRENCY
    });

    return {
        async processExposureResult(
            executionData: AnalysisJobExecutionData,
            exposure: AnalysisExposureDefinition,
            outputDir: string,
            timestep: number,
            teamId: string,
            artifactUploadBatch: ArtifactUploadBatch
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

            const storageKey = `plugins/trajectory-${executionData.trajectoryId}/analysis-${executionData.analysisId}/${exposure.nodeId}/timestep-${timestep}.msgpack.zst`;
            const fileStat = await fs.stat(outputFilePath);
            const storageOwnerClusterId = executionData.storageClusterId;
            if (!storageOwnerClusterId) {
                throw new Error(`Missing storage owner cluster for analysis ${executionData.analysisId}`);
            }

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

            await artifactUploadBatch.stageFileUpload({
                sourcePath: outputFilePath,
                ownerClusterId: storageOwnerClusterId,
                bucket: ObjectBucketName.Plugins,
                objectKey: storageKey,
                contentType: 'application/msgpack',
                fileName: `${exposure.nodeId}-timestep-${timestep}.msgpack.zst`
            });

            logger.info({ storageKey }, 'Queued exposure .msgpack upload');

            const queuedAt = Date.now();
            await exposureProcessingLimiter.schedule(async () => {
                const waitMs = Date.now() - queuedAt;
                if (waitMs >= 250) {
                    const counts = exposureProcessingLimiter.counts();
                    logger.info(
                        {
                            analysisId: executionData.analysisId,
                            exposure: exposure.name,
                            timestep,
                            waitMs,
                            activeCount: counts.RUNNING + counts.EXECUTING,
                            pending: counts.QUEUED,
                            concurrency: EXPOSURE_RESULT_PROCESSING_CONCURRENCY
                        },
                        'Exposure result processing waited for capacity'
                    );
                }

                    let { listing: listingPayload, subListingNames, exportData: exportPayload } = await readPayload(outputFilePath);

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

                    if (exposure.export && exportPayload) {
                        await exportNodeProcessorService.process({
                        executionData,
                        exposure,
                        decodedPayload: exportPayload,
                        timestep,
                        storageClusterId: storageOwnerClusterId,
                        artifactUploadBatch
                    });
                    }

                    // Release export data
                    exportPayload = null;
                    forceGC();
            });

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
    decoded: PayloadRecord | null,
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

    const cleanedMainListing: PayloadRecord = {};
    for (const [key, entryValue] of Object.entries(mainListing)) {
        if (Array.isArray(entryValue) && entryValue.length >= 1 && Array.isArray(entryValue[0])) {
            continue;
        }

        cleanedMainListing[key] = entryValue;
    }
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
