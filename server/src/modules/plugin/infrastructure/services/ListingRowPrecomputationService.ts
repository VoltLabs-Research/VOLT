import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IListingRowRepository, ListingRowUpsertOperation } from '@modules/plugin/domain/port/IListingRowRepository';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/ISubListingRowRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { getExposureNodes } from '@modules/plugin/infrastructure/utilities/get-exposure-nodes';
import logger from '@shared/infrastructure/logger';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import mergeChunkedValue from '@modules/plugin/infrastructure/utilities/merge-chunked-value';
import { SubListingRowProps } from '@modules/plugin/domain/entities/SubListingRow';
import { listExposurePayloadObjects } from '@modules/plugin/infrastructure/utilities/analysis-file-collection';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

interface PrecomputeAnalysisParams {
    analysisId: string;
    teamId?: string;
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
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                `Analysis not found: ${analysisId}`
            );
        }

        const plugin = await this.pluginRepo.findById(analysis.props.plugin);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                `Plugin not found: ${analysis.props.plugin}`
            );
        }

        const workflow = plugin.props.workflow;
        if (!workflow?.props?.nodes?.length) {
            throw ApplicationError.internalServerError(
                `Plugin workflow not found for plugin ${plugin._id}`
            );
        }

        const exposures = getExposureNodes(workflow.props.nodes);
        if (!exposures.length) {
            logger.info(`[ListingRowPrecomputation] No exposures found for plugin ${plugin._id}`);
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

                const upsertOperations: ListingRowUpsertOperation[] = [];

                for (const record of timestepRecords) {
                    const mainListingRow = record.mainListing;
                    if (!mainListingRow || typeof mainListingRow !== 'object' || Object.keys(mainListingRow).length === 0) {
                        logger.warn(
                            `[ListingRowPrecomputation] Empty main_listing: exposure=${descriptor.exposureName}, analysis=${analysisId}, timestep=${record.timestep}`
                        );
                        continue;
                    }

                    const subListingNames = Object.keys(record.subListings);

                    upsertOperations.push({
                        filter: {
                            analysis: analysisId,
                            exposureId: descriptor.exposureId,
                            timestep: record.timestep
                        },
                        update: {
                            plugin: plugin._id,
                            team: teamId,
                            trajectory: trajectoryId,
                            trajectoryName: '',
                            analysis: analysisId,
                            exposureName: descriptor.exposureName,
                            exposureId: descriptor.exposureId,
                            timestep: record.timestep,
                            row: mainListingRow,
                            subListingNames
                        }
                    });

                    materializedRows += 1;

                    for (const [subListingName, rawRows] of Object.entries(record.subListings)) {
                        const cleanedRows = cleanSubListingRows(rawRows);
                        if (cleanedRows.length === 0) {
                            continue;
                        }

                        const subListingDocuments = cleanedRows.map((cleanedRow) => ({
                            plugin: plugin._id,
                            team: teamId,
                            trajectory: trajectoryId,
                            analysis: analysisId,
                            exposureId: descriptor.exposureId,
                            exposureName: descriptor.exposureName,
                            timestep: record.timestep,
                            subListingName,
                            row: cleanedRow
                        }));

                        await this.subListingRowRepo.insertMany(subListingDocuments as Partial<SubListingRowProps>);
                    }
                }

                if (upsertOperations.length > 0) {
                    await this.listingRowRepo.bulkUpsert(upsertOperations);
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
            throw ApplicationError.internalServerError(
                `No listing rows were materialized for analysis ${analysisId}`
            );
        }

        if (exposureFailures.length > 0) {
            throw ApplicationError.internalServerError(
                `Listing precomputation partially failed for analysis ${analysisId}: ${exposureFailures.join(' | ')}`
            );
        }
    }

    private async collectTimestepRecords(
        trajectoryId: string,
        analysisId: string,
        exposureId: string
    ): Promise<TimestepRecord[]> {
        const payloadObjects = await listExposurePayloadObjects(
            this.storageService,
            trajectoryId,
            analysisId,
            exposureId
        );
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

    private async readDecodedPayload(objectName: string): Promise<Record<string, unknown> | null> {
        const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, objectName);
        let decoded: Record<string, unknown> | null = null;

        for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array | Buffer>)) {
            if (message && typeof message === 'object') {
                decoded = mergeChunkedValue(decoded, message);
            }
        }

        return decoded;
    }
}
