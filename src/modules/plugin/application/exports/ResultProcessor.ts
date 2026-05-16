import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import {
    createWorkflowExposureOutputFilePath,
    readWorkflowExposurePayload
} from '@/modules/analysis/application/workflow/exposure-payload-reader';
import type { MsgpackObject } from '@/support/serialization/msgpack-value';
import { isPlainObject } from '@/support/type-guards/is-record';
import type { PluginListingRepository } from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';
import { processExportNode } from '@/modules/plugin/application/exports/ExportNodeProcessor';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisStageReporter } from '@/modules/analysis/application/workflow/AnalysisStageReporter';
import type { ResultProcessorService } from '@/modules/plugin/application/exports/result-processor-service-contract';
import type { PluginMongoRow, PluginMongoValue } from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';
import type { PluginPropertyStore } from '@/modules/plugin/application/properties/PluginPropertyStore';
import fs from 'node:fs/promises';

@Service('resultProcessor')
export class DefaultResultProcessor implements ResultProcessorService {
    constructor(
        private readonly pluginListingRepository: PluginListingRepository,
        private readonly pluginPropertyStore: PluginPropertyStore
    ) {}

    async processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string,
        artifactUploadBatch: ArtifactUploadBatch,
        stageReporter?: AnalysisStageReporter
    ): Promise<void> {
        const outputFilePath = createWorkflowExposureOutputFilePath(outputDir, exposure.results);
        const startedAt = Date.now();
        const stageKey = `${executionData.identity.analysisId}:${timestep}:exposure:${exposure.nodeId}`;

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
        if (!storageOwnerClusterId) {
            throw new Error(`Missing storage owner cluster for analysis ${analysisId}`);
        }

        await stageReporter?.report({
            stageKey,
            label: `Process ${exposure.name}`,
            stageType: 'exposure',
            stageStatus: 'running',
            timestep,
            pluginId,
            nodeId: exposure.nodeId,
            exposureId: exposure.nodeId
        });

        try {
            let {
                listing: listingPayload,
                subListingNames,
                subListings,
                perAtomProperties,
                exportData: exportPayload
            } = await readWorkflowExposurePayload(outputFilePath);

            const isChartOnlyExposure = exposure.export?.exporter === 'ChartExporter';
            if (!isChartOnlyExposure) {
                const propertyStorage = await this.pluginPropertyStore.writeExposureProperties({
                    trajectoryId,
                    analysisId,
                    exposureId: exposure.nodeId,
                    timestep,
                    ownerClusterId: storageOwnerClusterId,
                    rows: perAtomProperties
                });
                const propertyObjectKey = propertyStorage?.objectKey;
                if (propertyStorage) {
                    logger.info(`Stored exposure per-atom properties as Parquet: objectKey=${propertyStorage.objectKey}, rows=${propertyStorage.rowCount}`);
                }

                await precomputeListingRows(
                    this.pluginListingRepository,
                    executionData,
                    exposure,
                    listingPayload,
                    subListingNames,
                    propertyObjectKey,
                    storageOwnerClusterId,
                    timestep,
                    teamId
                );

                await precomputeSubListingRows(
                    this.pluginListingRepository,
                    executionData,
                    exposure,
                    subListings,
                    timestep
                );
            }

            listingPayload = null;
            subListingNames = [];
            subListings = {};
            perAtomProperties = null;

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

            await stageReporter?.report({
                stageKey,
                label: `Process ${exposure.name}`,
                stageType: 'exposure',
                stageStatus: 'completed',
                timestep,
                pluginId,
                nodeId: exposure.nodeId,
                exposureId: exposure.nodeId
            });
        } catch (error) {
            await stageReporter?.report({
                stageKey,
                label: `Process ${exposure.name}`,
                stageType: 'exposure',
                stageStatus: 'failed',
                timestep,
                pluginId,
                nodeId: exposure.nodeId,
                exposureId: exposure.nodeId,
                detail: error instanceof Error ? error.message : undefined
            });
            throw error;
        }

        logger.info(`Finished exposure result processing: analysisId=${analysisId}, exposure=${exposure.name}, durationMs=${Date.now() - startedAt}, timestep=${timestep}`);
    }
}

async function precomputeListingRows(
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    decoded: MsgpackObject | null,
    subListingNames: string[],
    objectKey: string | undefined,
    propertyOwnerClusterId: string,
    timestep: number,
    teamId: string
): Promise<void> {
    if (!decoded) {
        logger.debug(`Exposure output has no listing payload for objectKey=${objectKey}`);
        return;
    }

    const mainListing = decoded.main_listing;
    if (!isPlainObject(mainListing) || Object.keys(mainListing).length === 0) {
        // Plugins that don't emit a main_listing (e.g. PTM Analysis exposure
        // emits per-atom data only) hit this path on every timestep — it is a
        // normal case, not a problem worth waking anyone up for.
        logger.debug(`No main_listing in decoded payload for objectKey=${objectKey}`);
        return;
    }

    const cleanedMainListing: PluginMongoRow = {};
    for (const [key, entryValue] of Object.entries(mainListing)) {
        if (
            Array.isArray(entryValue)
            || (typeof entryValue === 'object' && entryValue !== null)
        ) {
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
            ...(objectKey ? {
                propertyObjectKey: objectKey,
                propertyOwnerClusterId
            } : {}),
            subListingNames
        }
    }]);
}

async function precomputeSubListingRows(
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    subListings: Record<string, MsgpackObject[]>,
    timestep: number
): Promise<void> {
    const { analysisId } = executionData.identity;
    const inputs = Object.entries(subListings)
        .filter(([, rows]) => rows.length > 0)
        .map(([subListingName, rows]) => ({
            analysis: analysisId,
            exposureId: exposure.nodeId,
            timestep,
            subListingName,
            rows: rows as PluginMongoRow[]
        }));

    await pluginListingRepository.replaceSubListingRows(inputs);
}
