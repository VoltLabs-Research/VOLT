import Bottleneck from 'bottleneck';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import {
    createWorkflowExposureOutputFilePath,
    readWorkflowExposurePayload
} from '@/modules/analysis/application/workflow/exposure-payload-reader';
import type { MsgpackObject } from '@/support/serialization/msgpack-value';
import { isPlainObject } from '@/support/type-guards/is-record';
import type { PluginListingRepository } from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';
import { processExportNode } from '@/modules/plugin/application/exports/ExportNodeProcessor';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import { getRecommendedResultProcessingConcurrency } from '@/support/policies/analysis-resource-policy';
import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@/modules/analysis/contracts/http-analysis';
import type { ResultProcessorService } from '@/modules/plugin/application/exports/result-processor-service-contract';
import type { PluginMongoRow, PluginMongoValue } from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';
import fs from 'node:fs/promises';

const EXPOSURE_RESULT_PROCESSING_CONCURRENCY = getRecommendedResultProcessingConcurrency();

@Service('resultProcessor')
export class DefaultResultProcessor implements ResultProcessorService {
    private readonly exposureProcessingLimiter: Bottleneck;

    constructor(
        private readonly pluginListingRepository: PluginListingRepository
    ) {
        this.exposureProcessingLimiter = new Bottleneck({
            maxConcurrent: EXPOSURE_RESULT_PROCESSING_CONCURRENCY
        });
    }

    async processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string,
        artifactUploadBatch: ArtifactUploadBatch
    ): Promise<void> {
        const outputFilePath = createWorkflowExposureOutputFilePath(outputDir, exposure.results);
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

        const { analysisId, trajectoryId, pluginId, storageClusterId: storageOwnerClusterId } = executionData.identity;
        const storageKey = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposure.nodeId}/timestep-${timestep}.msgpack.zst`;
        if (!storageOwnerClusterId) {
            throw new Error(`Missing storage owner cluster for analysis ${analysisId}`);
        }

        await artifactUploadBatch.stageFileUpload({
            sourcePath: outputFilePath,
            ownerClusterId: storageOwnerClusterId,
            bucket: ObjectBucketName.Plugins,
            objectKey: storageKey,
            contentType: 'application/msgpack',
            fileName: `${exposure.nodeId}-timestep-${timestep}.msgpack.zst`
        });

        logger.info(`Queued exposure .msgpack upload for storageKey=${storageKey}`);

        const queuedAt = Date.now();
        await this.exposureProcessingLimiter.schedule(async () => {
            const waitMs = Date.now() - queuedAt;
            if (waitMs >= 250) {
                const counts = this.exposureProcessingLimiter.counts();
                logger.info(`Exposure result processing waited for capacity: analysisId=${analysisId}, exposure=${exposure.name}, timestep=${timestep}, waitMs=${waitMs}, activeCount=${counts.RUNNING + counts.EXECUTING}, pending=${counts.QUEUED}, concurrency=${EXPOSURE_RESULT_PROCESSING_CONCURRENCY}`);
            }

            let {
                listing: listingPayload,
                subListingNames,
                exportData: exportPayload
            } = await readWorkflowExposurePayload(outputFilePath);

            await precomputeListingRows(
                this.pluginListingRepository,
                executionData,
                exposure,
                listingPayload,
                subListingNames,
                storageKey,
                storageOwnerClusterId,
                timestep,
                teamId
            );

            listingPayload = null;
            subListingNames = [];

            if (exposure.export && exportPayload) {
                await processExportNode({
                    executionData: {
                        analysisId,
                        trajectoryId,
                        pluginId,
                        storageClusterId: storageOwnerClusterId
                    },
                    exposure,
                    decodedPayload: exportPayload,
                    timestep,
                    storageClusterId: storageOwnerClusterId,
                    artifactUploadBatch
                });
            }

            exportPayload = null;
        });

        logger.info(`Finished exposure result processing: analysisId=${analysisId}, exposure=${exposure.name}, durationMs=${Date.now() - startedAt}, storageKey=${storageKey}, timestep=${timestep}`);
    }
}

async function precomputeListingRows(
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    decoded: MsgpackObject | null,
    subListingNames: string[],
    objectKey: string,
    payloadOwnerClusterId: string,
    timestep: number,
    teamId: string
): Promise<void> {
    if (!decoded) {
        logger.debug(`Exposure output has no listing payload for objectKey=${objectKey}`);
        return;
    }

    const mainListing = decoded.main_listing;
    if (!isPlainObject(mainListing) || Object.keys(mainListing).length === 0) {
        logger.warn(`Empty or missing main_listing in decoded payload for objectKey=${objectKey}`);
        return;
    }

    const cleanedMainListing: PluginMongoRow = {};
    for (const [key, entryValue] of Object.entries(mainListing)) {
        if (Array.isArray(entryValue) && entryValue.length >= 1 && Array.isArray(entryValue[0])) {
            continue;
        }

        cleanedMainListing[key] = entryValue as PluginMongoValue;
    }
    if (Object.keys(cleanedMainListing).length === 0) {
        logger.warn(`main_listing only contained filtered values, skipping persistence for objectKey=${objectKey}`);
        return;
    }

    const { analysisId, trajectoryId, pluginId } = executionData.identity;
    await pluginListingRepository.bulkUpsertListingRows([{
        filter: {
            analysis: analysisId,
            exposureId: exposure.nodeId,
            timestep
        },
        update: {
            plugin: pluginId,
            team: teamId,
            trajectory: trajectoryId,
            analysis: analysisId,
            exposureName: exposure.name,
            exposureId: exposure.nodeId,
            timestep,
            row: cleanedMainListing,
            payloadObjectKey: objectKey,
            payloadOwnerClusterId,
            subListingNames
        }
    }]);
}
