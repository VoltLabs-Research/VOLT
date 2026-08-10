import path from 'node:path';
import { logger } from '@shared/infrastructure/logger';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@shared/contracts/channel/reverse-channel-plugin';
import type { ExportExecutionInput, ExporterEntry, ExporterName } from '@modules/plugin/services/exports/export-node-processor-types';
import type { JsonObject, JsonValue } from '@shared/contracts/types/json';
import type { ObjectBucketName } from '@shared/contracts/types/http-object-store';

export const YIELD_INTERVAL = 50_000;

export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export const getNestedValue = (data: JsonObject, key: string): JsonValue | undefined => {
    if (!key) {
        return data;
    }

    return key.split('.').reduce<JsonValue | undefined>((current, segment) => {
        if (typeof current !== 'object' || current === null || Array.isArray(current)) {
            return undefined;
        }

        return current[segment];
    }, data);
};

export const buildObjectPath = (
    input: ExportExecutionInput,
    exporter: ExporterName,
    type: string,
    arrayIndex?: number
): string => {
    const isChart = exporter === 'ChartExporter' || type === 'chart-png';
    const isSim = exporter === 'ConfigurationExporter';
    const folder = isChart ? 'charts' : isSim ? 'simulation' : 'glb';
    const extension = isChart ? 'png' : type;
    const suffix = arrayIndex != null ? `_${arrayIndex}` : '';

    return `trajectory-${input.executionData.trajectoryId}/analysis-${input.executionData.analysisId}/${folder}/${input.timestep}/${input.exposure.nodeId}${suffix}.${extension}`;
};

export const resolveExporterEntries = (
    decodedPayload: JsonObject,
    exporter: ExporterName
): ExporterEntry[] => {
    const rawExport = decodedPayload.export;

    if (Array.isArray(rawExport)) {
        const entries: ExporterEntry[] = [];

        for (let index = 0; index < rawExport.length; index += 1) {
            const element = rawExport[index];
            if (typeof element !== 'object' || element === null || Array.isArray(element)) {
                logger.warn(`Skipping non-record element in export array for exporter=${exporter}, index=${index}`);
                continue;
            }

            const exporterData = element[exporter];
            if (typeof exporterData !== 'object' || exporterData === null || Array.isArray(exporterData)) {
                logger.warn(`Exporter key missing from export array element for exporter=${exporter}, index=${index}`);
                continue;
            }

            entries.push({
                exportData: exporterData,
                arrayIndex: index
            });
        }

        return entries;
    }

    if (typeof rawExport !== 'object' || rawExport === null) {
        return [];
    }

    const exporterData = rawExport[exporter];
    if (typeof exporterData !== 'object' || exporterData === null || Array.isArray(exporterData)) {
        return [];
    }

    return [{
        exportData: exporterData,
        arrayIndex: undefined
    }];
};

const buildArtifactReportInput = (
    input: ExportExecutionInput,
    exporter: ExporterName,
    exportConfig: NonNullable<ExportExecutionInput['exposure']['export']>,
    objectPath: string,
    storageBucket: string,
    arrayIndex?: number
): ReportArtifactInput => {
    const displayName = arrayIndex != null
        ? `${input.exposure.name} [${arrayIndex}]`
        : input.exposure.name;

    return {
        trajectory: input.executionData.trajectoryId,
        storageClusterId: input.storageClusterId,
        analysis: input.executionData.analysisId,
        plugin: input.executionData.pluginId,
        sourceType: 'plugin-exposure',
        timestep: input.timestep,
        objectName: objectPath,
        storageBucket,
        params: {
            exposureId: input.exposure.nodeId,
            arrayIndex
        },
        displayName,
        status: 'ready',
        metadata: {
            pluginId: input.executionData.pluginId,
            exposureId: input.exposure.nodeId,
            exposureName: input.exposure.name,
            exporter,
            exportType: exportConfig.type,
            arrayIndex
        }
    };
};

export const stageExportBufferUpload = (
    input: ExportExecutionInput,
    args: {
        exporter: ExporterName;
        bucket: ObjectBucketName;
        buffer: Buffer;
        contentType: string;
        objectPath: string;
        ownerClusterId: string;
    }
): Promise<void> =>
    input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId: args.ownerClusterId,
        bucket: args.bucket,
        objectKey: args.objectPath,
        buffer: args.buffer,
        contentType: args.contentType,
        fileName: path.basename(args.objectPath),
        reportArtifact: buildArtifactReportInput(
            input,
            args.exporter,
            input.exposure.export!,
            args.objectPath,
            args.bucket
        )
    });
