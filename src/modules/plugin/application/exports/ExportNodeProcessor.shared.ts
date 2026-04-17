import { logger } from '@/core/logger';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/application/events/SceneArtifactUpsertBatchItem';
import type { ExportExecutionInput, ExporterEntry, ExporterName } from '@/modules/plugin/application/exports/ExportNodeProcessor.types';
import { isRecord } from '@/support/type-guards/isRecord';

type ExportValue = boolean | null | number | string;

export const YIELD_INTERVAL = 50_000;

export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export const getNestedValue = (data: object, key: string): ExportValue | object | object[] | undefined => {
    if (!key) {
        return data;
    }

    return key.split('.').reduce<ExportValue | object | object[] | undefined>((current, segment) => {
        if (!isRecord(current)) {
            return undefined;
        }

        return current[segment] as ExportValue | object | object[] | undefined;
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

export const logSkippedEmptyExport = (
    input: ExportExecutionInput,
    exporter: ExporterName,
    reason: string,
    arrayIndex?: number
): void => {
    logger.info(
        {
            analysisId: input.executionData.analysisId,
            exposureName: input.exposure.name,
            exposureNodeId: input.exposure.nodeId,
            exporter,
            timestep: input.timestep,
            ...(arrayIndex != null ? { arrayIndex } : {}),
            reason
        },
        'No exportable results found for exposure export; skipping artifact generation'
    );
};

export const resolveExporterEntries = (
    decodedPayload: object,
    exporter: ExporterName
): ExporterEntry[] => {
    if (!isRecord(decodedPayload)) {
        return [];
    }

    const rawExport = decodedPayload.export;

    if (Array.isArray(rawExport)) {
        const entries: ExporterEntry[] = [];

        for (let index = 0; index < rawExport.length; index += 1) {
            const element = rawExport[index];
            if (!isRecord(element)) {
                logger.warn({ exporter, index }, 'Skipping non-record element in export array');
                continue;
            }

            const exporterData = element[exporter];
            if (!isRecord(exporterData)) {
                logger.warn({ exporter, index }, 'Exporter key missing from export array element');
                continue;
            }

            entries.push({ exportData: exporterData, arrayIndex: index });
        }

        return entries;
    }

    if (!isRecord(rawExport)) {
        return [];
    }

    const exporterData = rawExport[exporter];
    if (!isRecord(exporterData)) {
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
            ...(arrayIndex != null ? { arrayIndex } : {})
        },
        displayName,
        status: 'ready',
        metadata: {
            pluginId: input.executionData.pluginId,
            exposureId: input.exposure.nodeId,
            exposureName: input.exposure.name,
            exporter,
            exportType: exportConfig.type,
            ...(arrayIndex != null ? { arrayIndex } : {})
        }
    };
};

export const isChartExporter = (exporter: ExporterName, type: string): boolean => {
    return exporter === 'ChartExporter' || type === 'chart-png';
};
