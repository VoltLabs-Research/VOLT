import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import logger from '@shared/infrastructure/logger';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import mergeChunkedValue from '@modules/plugin/infrastructure/utilities/merge-chunked-value';

interface PrecomputeAnalysisParams {
    analysisId: string;
    teamId?: string;
}

interface ExposureDescriptor {
    exposureId: string;
    exposureName: string;
}

@injectable()
export class ListingRowPrecomputationService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,
        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private listingRowRepo: IListingRowRepository,
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private sceneArtifactRepo: ISceneArtifactRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ) {}

    async precomputeForAnalysis(params: PrecomputeAnalysisParams): Promise<void> {
        const { analysisId, teamId: inputTeamId } = params;

        const analysis = await this.analysisRepo.findById(analysisId);
        if (!analysis) {
            throw new Error(`Analysis::NotFound:${analysisId}`);
        }

        const plugin = await this.pluginRepo.findById(analysis.props.plugin);
        if (!plugin) {
            throw new Error(`Plugin::NotFound:${analysis.props.plugin}`);
        }

        const workflow = plugin.props.workflow;
        if (!workflow?.props?.nodes?.length) {
            throw new Error(`Plugin::WorkflowMissing:${plugin.id}`);
        }

        const exposures = this.findExposures(workflow);
        if (!exposures.length) {
            logger.info(`[ListingRowPrecomputation] No exposures found for plugin ${plugin.id}`);
            return;
        }

        const teamId = inputTeamId || analysis.props.team;
        const trajectoryId = analysis.props.trajectory;
        const exposureFailures: string[] = [];
        let materializedRows = 0;

        console.log(exposures)
        for (const descriptor of exposures) {
            try {
                const listingRecords = await this.collectListingRecords(
                    analysisId,
                    trajectoryId,
                    descriptor.exposureId
                );

                console.log('LISTING RECORDS:', listingRecords);

                if (!listingRecords.length) {
                    logger.warn(
                        `[ListingRowPrecomputation] No listing records for exposure=${descriptor.exposureName}, analysis=${analysisId}`
                    );
                    continue;
                }

                for (const record of listingRecords) {
                    const row = record.mainListing;
                    if (!row || typeof row !== 'object' || Object.keys(row).length === 0) {
                        logger.warn(
                            `[ListingRowPrecomputation] Empty main_listing: exposure=${descriptor.exposureName}, analysis=${analysisId}, timestep=${record.timestep}`
                        );
                        continue;
                    }

                    const rowData = {
                        plugin: plugin.id,
                        team: teamId,
                        trajectory: trajectoryId,
                        trajectoryName: '',
                        analysis: analysisId,
                        exposureName: descriptor.exposureName,
                        exposureId: descriptor.exposureId,
                        timestep: record.timestep,
                        row
                    };

                    const existing = await this.listingRowRepo.findOne({
                        analysis: analysisId,
                        exposureId: descriptor.exposureId,
                        timestep: record.timestep
                    });

                    if (existing) {
                        await this.listingRowRepo.updateById(existing.id, rowData);
                    } else {
                        await this.listingRowRepo.create(rowData);
                    }

                    materializedRows += 1;
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error(
                    `[ListingRowPrecomputation] Exposure failed: exposure=${descriptor.exposureName}, analysis=${analysisId}, error=${message}`
                );
                exposureFailures.push(message);
            }
        }

        if (materializedRows === 0) {
            throw new Error(`ListingPrecompute::NoRowsMaterialized:analysis=${analysisId}`);
        }

        if (exposureFailures.length > 0) {
            throw new Error(
                `ListingPrecompute::PartialFailure:analysis=${analysisId}:failures=${exposureFailures.join(' | ')}`
            );
        }
    }

    private findExposures(workflow: { props: { nodes: Array<{ id: string; type: string; data: Record<string, any> }> } }): ExposureDescriptor[] {
        const nodes = workflow.props.nodes || [];
        const descriptors: ExposureDescriptor[] = [];

        for (const node of nodes) {
            if (node.type !== WorkflowNodeType.Exposure) continue;

            const exposureName = String(node.data?.exposure?.name || '').trim();
            if (!exposureName) continue;

            descriptors.push({
                exposureId: node.id,
                exposureName
            });
        }

        return descriptors;
    }

    private async collectListingRecords(
        analysisId: string,
        trajectoryId: string,
        exposureId: string
    ): Promise<Array<{ timestep: number; mainListing: Record<string, unknown> }>> {
        const artifacts = await this.sceneArtifactRepo.findAll({
            filter: {
                analysis: analysisId,
                sourceType: 'plugin-exposure',
                'params.exposureId': exposureId
            } as Record<string, unknown>,
            page: 1,
            limit: 100000,
            sort: { timestep: 1, _id: 1 }
        });

        if (artifacts.data.length) {
            return this.extractFromArtifacts(artifacts.data);
        }

        return this.extractFromStoragePayloads(trajectoryId, analysisId, exposureId);
    }

    private extractFromArtifacts(
        artifacts: Array<{ props: { timestep: number; metadata: Record<string, any> } }>
    ): Array<{ timestep: number; mainListing: Record<string, unknown> }> {
        const records: Array<{ timestep: number; mainListing: Record<string, unknown> }> = [];

        for (const artifact of artifacts) {
            const rawMetadata = artifact.props.metadata;
            const listingMetadata = rawMetadata?.listingMetadata ?? rawMetadata;
            const mainListing = listingMetadata?.main_listing;

            if (!mainListing || typeof mainListing !== 'object') continue;

            records.push({
                timestep: artifact.props.timestep,
                mainListing
            });
        }

        return records;
    }

    private async extractFromStoragePayloads(
        trajectoryId: string,
        analysisId: string,
        exposureId: string
    ): Promise<Array<{ timestep: number; mainListing: Record<string, unknown> }>> {
        const payloadObjects = await this.listExposurePayloadObjects(trajectoryId, analysisId, exposureId);
        const records: Array<{ timestep: number; mainListing: Record<string, unknown> }> = [];

        for (const payloadObject of payloadObjects) {
            const decoded = await this.readDecodedPayload(payloadObject.objectName);
            const mainListing = decoded?.main_listing;

            if (!mainListing || typeof mainListing !== 'object') continue;

            records.push({
                timestep: payloadObject.timestep,
                mainListing
            });
        }

        return records;
    }

    private async listExposurePayloadObjects(
        trajectoryId: string,
        analysisId: string,
        exposureId: string
    ): Promise<Array<{ objectName: string; timestep: number }>> {
        const prefix = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/`;
        const objects: Array<{ objectName: string; timestep: number }> = [];

        for await (const objectName of this.storageService.listByPrefix(SYS_BUCKETS.PLUGINS, prefix, true)) {
            const match = objectName.match(/timestep-(\d+)\.msgpack$/);
            if (!match) continue;

            objects.push({
                objectName,
                timestep: Number(match[1])
            });
        }

        objects.sort((a, b) => a.timestep - b.timestep);
        return objects;
    }

    private async readDecodedPayload(objectName: string): Promise<Record<string, any> | null> {
        const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, objectName);
        let decoded: Record<string, any> | null = null;

        for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array | Buffer>)) {
            if (message && typeof message === 'object') {
                decoded = mergeChunkedValue(decoded, message);
            }
        }

        return decoded;
    }
}
