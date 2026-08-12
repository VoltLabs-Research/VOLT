import { singleton } from '@shared/application/utilities/singleton';
import { getPluginListingRepository } from '@modules/plugin/models/PluginListingRepository';
import { getPluginPropertyStore } from '@modules/plugin/services/ParquetPluginPropertyStore';
import { logger } from '@shared/infrastructure/logger';
import {
    createWorkflowExposureOutputFilePath,
    readWorkflowExposurePayload
} from '@modules/analysis/services/workflow/exposure-payload-reader';
import {
    precomputeListingRows,
    precomputeSubListingRows
} from '@modules/plugin/services/exports/listing-row-precompute';
import { processExportNode } from '@modules/plugin/services/exports/ExportNodeProcessor';
import type { ArtifactUploadBatch } from '@shared/contracts/types/artifact-upload';
import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@shared/contracts/types/http-analysis';
import type { AnalysisStageReporter } from '@shared/contracts/types/analysis-stage-reporter';
import type { ResultProcessorService } from '@shared/contracts/types/result-processor-service';
import type { PluginListingRepository } from '@modules/plugin/models/PluginListingRepository';
import type { PluginPropertyStore } from '@modules/plugin/services/properties/PluginPropertyStore';
import fs from 'node:fs/promises';

const isParquetExposure = (resultsFileName: string): boolean =>
    resultsFileName.toLowerCase().endsWith('.parquet');

class DefaultResultProcessor implements ResultProcessorService {
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
        const reportStage = (
            stageStatus: 'running' | 'completed' | 'failed',
            detail?: string,
            producedArtifacts?: boolean
        ): Promise<void> | undefined => stageReporter?.report({
            stageKey: `${executionData.identity.analysisId}:${timestep}:exposure:${exposure.nodeId}`,
            label: `Process ${exposure.name}`,
            stageType: 'exposure',
            stageStatus,
            timestep,
            pluginId: executionData.identity.pluginId,
            nodeId: exposure.nodeId,
            exposureId: exposure.nodeId,
            detail,
            producedArtifacts
        });

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

            // Opt-in exports write no file when they are switched off, which is
            // the normal outcome rather than a fault. Close the exposure out, or
            // its expected artifact waits forever on an upload nobody will send.
            if (exposure.export) {
                await reportStage('completed', 'No output file for this exposure', false);
            }

            return;
        }

        if (!isParquetExposure(exposure.results)) {
            logger.debug(
                {
                    exposure: exposure.name,
                    results: exposure.results
                },
                'Non-Parquet shared-context exposure; skipping scene/property processing'
            );
            return;
        }

        const { analysisId, trajectoryId, pluginId, storageClusterId: storageOwnerClusterId } = executionData.identity;
        if (!storageOwnerClusterId) {
            throw new Error(`Missing storage owner cluster for analysis ${analysisId}`);
        }

        await reportStage('running');

        try {
            const skipSubListings = exposure.export?.exporter === 'MeshExporter';

            let {
                listing: listingPayload,
                subListingNames,
                subListings,
                perAtomProperties,
                perAtomSource,
                entityKind,
                exportData: exportPayload
            } = await readWorkflowExposurePayload(outputFilePath, { skipSubListings });

            const isChartOnlyExposure = exposure.export?.exporter === 'ChartExporter';
            if (!isChartOnlyExposure) {
                const propertyStorage = await this.pluginPropertyStore.writeExposureProperties({
                    trajectoryId,
                    analysisId,
                    exposureId: exposure.nodeId,
                    timestep,
                    ownerClusterId: storageOwnerClusterId,
                    rows: perAtomProperties,
                    source: perAtomSource,
                    entityKind
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
            subListings = [];
            perAtomProperties = null;
            perAtomSource = null;

            let producedArtifacts: boolean | undefined;
            if (exposure.export) {
                producedArtifacts = exportPayload
                    ? await processExportNode({
                        executionData: {
                            analysisId,
                            trajectoryId,
                            pluginId,
                            storageClusterId: storageOwnerClusterId
                        },
                        exposure,
                        decodedPayload: exportPayload,
                        outputFilePath,
                        timestep,
                        storageClusterId: storageOwnerClusterId,
                        artifactUploadBatch
                    })
                    : false;

                if (!producedArtifacts) {
                    logger.warn(
                        {
                            analysisId,
                            exposure: exposure.name,
                            exposureId: exposure.nodeId,
                            timestep,
                            exporter: exposure.export.exporter,
                            hasExportPayload: Boolean(exportPayload)
                        },
                        'Exposure declares an export but produced no artifact'
                    );
                }
            }

            exportPayload = null;

            await reportStage('completed', undefined, producedArtifacts);
        } catch (error) {
            await reportStage('failed', error instanceof Error ? error.message : undefined);
            throw error;
        }

        logger.info(`Finished exposure result processing: analysisId=${analysisId}, exposure=${exposure.name}, durationMs=${Date.now() - startedAt}, timestep=${timestep}`);
    }
}

export const getResultProcessor = singleton((): DefaultResultProcessor => new DefaultResultProcessor(getPluginListingRepository(), getPluginPropertyStore()));
