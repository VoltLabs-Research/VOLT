import { AnalysisExposureDefinition, type AnalysisJobExecutionData } from '../../../shared/contracts';
import { logger } from '../../../core/logger';
import type { MinioService } from '../../platform/services';
import type { PluginListingRepository } from '../repositories/PluginListingRepository';
import type { ExportNodeProcessorService } from './ExportNodeProcessorService';
import { Decoder } from '@msgpack/msgpack';
import fs from 'node:fs/promises';
import type { Readable } from 'node:stream';

const PLUGINS_BUCKET = 'volt-plugins';

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const shouldIgnoreValue = (value: unknown): boolean => {
    return Array.isArray(value) && value.length >= 1 && Array.isArray(value[0]);
};

const cleanSubListingRows = (rawRows: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
    if (rawRows.length === 0) {
        return [];
    }

    const firstRow = rawRows[0];
    const validKeys = Object.keys(firstRow).filter((key) => !shouldIgnoreValue(firstRow[key]));

    return rawRows.map((rawRow) => {
        const cleaned: Record<string, unknown> = {};
        for (const key of validKeys) {
            cleaned[key] = rawRow[key];
        }

        return cleaned;
    });
};

const mergeChunkedValue = (target: unknown, incoming: unknown): unknown => {
    if (incoming === null) {
        return target;
    }
    if (target === null) {
        return incoming;
    }

    if (Array.isArray(target) && Array.isArray(incoming)) {
        target.push(...incoming);
        return target;
    }

    if (isRecord(target) && isRecord(incoming)) {
        for (const [key, incomingValue] of Object.entries(incoming)) {
            const targetValue = target[key];

            if (Array.isArray(targetValue) && Array.isArray(incomingValue)) {
                targetValue.push(...incomingValue);
            } else if (isRecord(targetValue) && isRecord(incomingValue)) {
                target[key] = mergeChunkedValue(targetValue, incomingValue);
            } else {
                target[key] = incomingValue;
            }
        }

        return target;
    }

    return incoming;
};

async function* decodeMultiStream(src: AsyncIterable<Uint8Array | Buffer>): AsyncIterable<unknown> {
    const decoder = new Decoder<unknown>();
    const byteSrc = (async function* () {
        for await (const chunk of src) {
            yield chunk;
        }
    })();

    for await (const value of decoder.decodeStream(byteSrc)) {
        yield value;
    }
}

async function readDecodedPayload(stream: Readable): Promise<Record<string, unknown> | null> {
    const asyncIterable = (async function* () {
        for await (const chunk of stream) {
            yield chunk as Uint8Array | Buffer;
        }
    })();

    let decoded: Record<string, unknown> | null = null;
    for await (const message of decodeMultiStream(asyncIterable)) {
        if (isRecord(message)) {
            const mergedPayload = mergeChunkedValue(decoded, message);
            if (isRecord(mergedPayload)) {
                decoded = mergedPayload;
            }
        }
    }

    return decoded;
}

async function readDecodedPayloadFromObject(
    minioService: MinioService,
    objectKey: string
): Promise<Record<string, unknown> | null> {
    const stream = await minioService.getObjectStream(PLUGINS_BUCKET, objectKey);
    return readDecodedPayload(stream);
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
    minioService: MinioService,
    pluginListingRepository: PluginListingRepository,
    exportNodeProcessorService: ExportNodeProcessorService
): ResultProcessorService => ({
    async processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string
    ): Promise<void> {
        const outputFilePath = `${outputDir}_${exposure.results}`;

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
        const fileBuffer = await fs.readFile(outputFilePath);

        await minioService.putObject({
            bucket: PLUGINS_BUCKET,
            objectKey: storageKey,
            body: fileBuffer,
            metadata: {
                'Content-Type': 'application/msgpack'
            }
        });

        logger.info({ storageKey }, 'Uploaded exposure .msgpack');
        const decoded = await readDecodedPayloadFromObject(minioService, storageKey);
        await precomputeListingRows(pluginListingRepository, executionData, exposure, decoded, storageKey, timestep, teamId);

        if (decoded && exposure.export) {
            await exportNodeProcessorService.process({
                executionData,
                exposure,
                decodedPayload: decoded,
                timestep,
                teamClusterId: executionData.teamClusterId || ''
            });
        }
    }
});

async function precomputeListingRows(
    pluginListingRepository: PluginListingRepository,
    executionData: AnalysisJobExecutionData,
    exposure: AnalysisExposureDefinition,
    decoded: Record<string, unknown> | null,
    objectKey: string,
    timestep: number,
    teamId: string
): Promise<void> {
    if (!decoded) {
        logger.warn({ objectKey }, 'Failed to decode msgpack payload');
        return;
    }

    const mainListing = decoded.main_listing;
    if (!mainListing || typeof mainListing !== 'object' || Object.keys(mainListing).length === 0) {
        logger.warn({ objectKey }, 'Empty or missing main_listing in decoded payload');
        return;
    }

    await pluginListingRepository.deleteSubListingRows({
        analysis: executionData.analysisId,
        exposureId: exposure.nodeId
    });

    let subListings: Record<string, Array<Record<string, unknown>>> = {};
    const rawSubListings = decoded.sub_listings;
    if (rawSubListings && typeof rawSubListings === 'object') {
        const entries = Object.entries(rawSubListings);
        for (const [name, value] of entries) {
            if (Array.isArray(value) && value.length > 0) {
                subListings[name] = value.filter(isRecord);
            }
        }
    }

    const subListingNames = Object.keys(subListings);

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
            row: mainListing,
            subListingNames
        }
    }]);

    for (const [subListingName, rawRows] of Object.entries(subListings)) {
        const cleanedRows = cleanSubListingRows(rawRows);
        if (cleanedRows.length === 0) {
            continue;
        }

        const documents = cleanedRows.map((cleanedRow) => ({
            plugin: executionData.pluginId,
            team: teamId,
            trajectory: executionData.trajectoryId,
            analysis: executionData.analysisId,
            exposureId: exposure.nodeId,
            exposureName: exposure.name,
            timestep,
            subListingName,
            row: cleanedRow
        }));

        await pluginListingRepository.insertSubListingRows(documents);
    }

    logger.info(
        {
            exposure: exposure.name,
            timestep,
            subListingCount: subListingNames.length
        },
        'Listing rows precomputed'
    );
}
