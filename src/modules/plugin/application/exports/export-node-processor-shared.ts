import { logger } from '@/core/logger';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/contracts/reverse-channel-plugin';
import type { ExportExecutionInput, ExporterEntry, ExporterName } from '@/modules/plugin/application/exports/export-node-processor-types';
import type { MsgpackObject, MsgpackScalar, MsgpackValue } from '@/support/serialization/msgpack-value';

type ExportValue = MsgpackScalar;

export const YIELD_INTERVAL = 50_000;

export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export const getNestedValue = (data: MsgpackObject, key: string): MsgpackValue | undefined => {
    if (!key) {
        return data;
    }

    return key.split('.').reduce<MsgpackValue | undefined>((current, segment) => {
        if (typeof current !== 'object' || current === null || current instanceof Array) {
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
    const folder = isChart ? 'charts' : 'glb';
    const extension = isChart ? 'png' : type;
    const suffix = arrayIndex != null ? `_${arrayIndex}` : '';

    return `trajectory-${input.executionData.trajectoryId}/analysis-${input.executionData.analysisId}/${folder}/${input.timestep}/${input.exposure.nodeId}${suffix}.${extension}`;
};

export const resolveExporterEntries = (
    decodedPayload: MsgpackObject,
    exporter: ExporterName
): ExporterEntry[] => {
    const rawExport = decodedPayload.export;

    if (rawExport instanceof Array) {
        const entries: ExporterEntry[] = [];

        for (let index = 0; index < rawExport.length; index += 1) {
            const element = rawExport[index];
            if (typeof element !== 'object' || element === null || element instanceof Array) {
                logger.warn(`Skipping non-record element in export array for exporter=${exporter}, index=${index}`);
                continue;
            }

            const exporterData = element[exporter];
            if (typeof exporterData !== 'object' || exporterData === null || exporterData instanceof Array) {
                logger.warn(`Exporter key missing from export array element for exporter=${exporter}, index=${index}`);
                continue;
            }

            entries.push({ exportData: exporterData, arrayIndex: index });
        }

        return entries;
    }

    if (typeof rawExport !== 'object' || rawExport === null) {
        return [];
    }

    const exporterData = rawExport[exporter];
    if (typeof exporterData !== 'object' || exporterData === null || exporterData instanceof Array) {
        return [];
    }

    return [{ exportData: exporterData, arrayIndex: undefined }];
};

export const buildArtifactReportInput = (
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
