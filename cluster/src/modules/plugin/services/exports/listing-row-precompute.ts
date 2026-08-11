import { logger } from '@shared/infrastructure/logger';
import { isRecord } from '@shared/domain/utilities/is-record';
import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@shared/contracts/types/http-analysis';
import type { JsonObject } from '@shared/contracts/types/json';
import type { PluginListingRepository } from '@modules/plugin/models/PluginListingRepository';
import type { PluginListingTransferRow } from '@modules/plugin/models/plugin-listing-repository-contract';
import type { SubListingBatchSource } from '@shared/contracts/types/workflow-exposure';

/** Flattens an exposure payload into the precomputed listing rows the UI reads. */

export const precomputeListingRows = async (
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    decoded: JsonObject | null,
    subListingNames: string[],
    objectKey: string | undefined,
    timestep: number,
    teamId: string
): Promise<void> => {
    if (!decoded) {
        logger.debug(`Exposure output has no listing payload for objectKey=${objectKey}`);
        return;
    }

    const mainListing = decoded.main_listing;
    if (!isRecord(mainListing) || Object.keys(mainListing).length === 0) {
        logger.debug(`No main_listing in decoded payload for objectKey=${objectKey}`);
        return;
    }

    const cleanedMainListing: PluginListingTransferRow = {};
    for (const [key, entryValue] of Object.entries(mainListing)) {
        if (typeof entryValue === 'object' && entryValue !== null) {
            continue;
        }

        cleanedMainListing[key] = entryValue;
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
            subListingNames
        }
    }]);
};

/**
 * Persists the sub-listings a batch at a time.
 *
 * The batches come from the reader, which never holds a whole sub-listing: a mesh over
 * a multi-million-atom frame describes tens of millions of entries, so both the read
 * and the write have to stay bounded.
 */
export const precomputeSubListingRows = async (
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    subListings: SubListingBatchSource[],
    timestep: number
): Promise<void> => {
    const { analysisId } = executionData.identity;
    const inputs = subListings
        .filter((source) => source.rowCount > 0)
        .map((source) => ({
            analysis: analysisId,
            exposureId: exposure.nodeId,
            timestep,
            subListingName: source.name,
            rowBatches: source.readBatches() as AsyncIterable<PluginListingTransferRow[]>
        }));

    if (inputs.length === 0) {
        return;
    }

    logger.debug(
        {
            analysis: analysisId,
            exposureId: exposure.nodeId,
            timestep,
            subListings: subListings.map((source) => `${source.name}=${source.rowCount}`)
        },
        'Persisting precomputed sub-listing rows'
    );

    await pluginListingRepository.replaceSubListingRows(inputs);
};
