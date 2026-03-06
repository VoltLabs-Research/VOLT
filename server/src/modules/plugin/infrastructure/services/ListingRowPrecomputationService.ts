import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/port/IListingRowRepository';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/ISubListingRowRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import logger from '@shared/infrastructure/logger';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import mergeChunkedValue from '@modules/plugin/infrastructure/utilities/merge-chunked-value';
import { SubListingRowProps } from '@modules/plugin/domain/entities/SubListingRow';

interface PrecomputeAnalysisParams {
    analysisId: string;
    teamId?: string;
}

interface ExposureDescriptor {
    exposureId: string;
    exposureName: string;
}

interface TimestepRecord {
    timestep: number;
    mainListing: Record<string, unknown>;
    subListings: Record<string, Array<Record<string, unknown>>>;
}

const shouldIgnoreValue = (value: unknown): boolean => {
    return Array.isArray(value) && value.length >= 1 && Array.isArray(value[0]);
};

const cleanSubListingRows = (
    rawRows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
    if (rawRows.length === 0) {
        return [];
    }

    const firstRow = rawRows[0];
    const validKeys = Object.keys(firstRow).filter(
        (key) => !shouldIgnoreValue(firstRow[key])
    );

    return rawRows.map((rawRow) => {
        const cleaned: Record<string, unknown> = {};
        for (const key of validKeys) {
            cleaned[key] = rawRow[key];
        }
        return cleaned;
    });
};

@injectable()
export class ListingRowPrecomputationService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,
        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private listingRowRepo: IListingRowRepository,
        @inject(PLUGIN_TOKENS.SubListingRowRepository)
        private subListingRowRepo: ISubListingRowRepository,
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

        for (const descriptor of exposures) {
            try {
                await this.subListingRowRepo.deleteMany({
                    analysis: analysisId,
                    exposureId: descriptor.exposureId
                } as Partial<SubListingRowProps>);

                const timestepRecords = await this.collectTimestepRecords(
                    trajectoryId,
                    analysisId,
                    descriptor.exposureId
                );

                if (!timestepRecords.length) {
                    logger.warn(
                        `[ListingRowPrecomputation] No records for exposure=${descriptor.exposureName}, analysis=${analysisId}`
                    );
                    continue;
                }

                for (const record of timestepRecords) {
                    const mainListingRow = record.mainListing;
                    if (!mainListingRow || typeof mainListingRow !== 'object' || Object.keys(mainListingRow).length === 0) {
                        logger.warn(
                            `[ListingRowPrecomputation] Empty main_listing: exposure=${descriptor.exposureName}, analysis=${analysisId}, timestep=${record.timestep}`
                        );
                        continue;
                    }

                    const subListingNames = Object.keys(record.subListings);

                    const rowData = {
                        plugin: plugin.id,
                        team: teamId,
                        trajectory: trajectoryId,
                        trajectoryName: '',
                        analysis: analysisId,
                        exposureName: descriptor.exposureName,
                        exposureId: descriptor.exposureId,
                        timestep: record.timestep,
                        row: mainListingRow,
                        subListingNames
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

                    for (const [subListingName, rawRows] of Object.entries(record.subListings)) {
                        const cleanedRows = cleanSubListingRows(rawRows);
                        if (cleanedRows.length === 0) {
                            continue;
                        }

                        const subListingDocuments = cleanedRows.map((cleanedRow) => ({
                            plugin: plugin.id,
                            team: teamId,
                            trajectory: trajectoryId,
                            analysis: analysisId,
                            exposureId: descriptor.exposureId,
                            exposureName: descriptor.exposureName,
                            timestep: record.timestep,
                            subListingName,
                            row: cleanedRow
                        }));

                        await this.subListingRowRepo.insertMany(subListingDocuments as any);
                    }
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

    private async collectTimestepRecords(
        trajectoryId: string,
        analysisId: string,
        exposureId: string
    ): Promise<TimestepRecord[]> {
        const payloadObjects = await this.listExposurePayloadObjects(trajectoryId, analysisId, exposureId);
        const records: TimestepRecord[] = [];

        for (const payloadObject of payloadObjects) {
            const decoded = await this.readDecodedPayload(payloadObject.objectName);
            if (!decoded) {
                continue;
            }

            const mainListing = decoded.main_listing;
            if (!mainListing || typeof mainListing !== 'object') {
                continue;
            }

            const rawSubListings = decoded.sub_listings;
            let subListings: Record<string, Array<Record<string, unknown>>> = {};

            if (rawSubListings && typeof rawSubListings === 'object') {
                const entries = Object.entries(rawSubListings as Record<string, unknown>);
                for (const [name, value] of entries) {
                    if (Array.isArray(value) && value.length > 0) {
                        subListings[name] = value as Array<Record<string, unknown>>;
                    }
                }
            }

            records.push({
                timestep: payloadObject.timestep,
                mainListing: mainListing as Record<string, unknown>,
                subListings
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
