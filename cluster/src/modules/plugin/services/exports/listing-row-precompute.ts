import { logger } from '@shared/infrastructure/logger';
import { isRecord } from '@shared/domain/utilities/is-record';
import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@shared/contracts/types/http-analysis';
import type { JsonObject } from '@shared/contracts/types/json';
import type { PluginListingRepository } from '@modules/plugin/models/PluginListingRepository';
import type { PluginListingTransferRow } from '@modules/plugin/models/plugin-listing-repository-contract';

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

export const precomputeSubListingRows = async (
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    subListings: Record<string, JsonObject[]>,
    timestep: number
): Promise<void> => {
    const { analysisId } = executionData.identity;
    const inputs = Object.entries(subListings)
        .filter(([, rows]) => rows.length > 0)
        .map(([subListingName, rows]) => ({
            analysis: analysisId,
            exposureId: exposure.nodeId,
            timestep,
            subListingName,
            rows: rows as PluginListingTransferRow[]
        }));

    await pluginListingRepository.replaceSubListingRows(inputs);
};
