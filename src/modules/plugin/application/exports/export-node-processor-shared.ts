import { logger } from '@/core/logger';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/contracts/reverse-channel-plugin';
import type { ExportExecutionInput, ExporterEntry, ExporterName } from '@/modules/plugin/application/exports/export-node-processor-types';

type ExportValue = boolean | null | number | string;

export const YIELD_INTERVAL = 50_000;

export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export const getNestedValue = (data: object, key: string): ExportValue | object | object[] | undefined => {
    if (!key) {
        return data;
    }

    return key.split('.').reduce<ExportValue | object | object[] | undefined>((current, segment) => {
        if (typeof current !== 'object' || current === null || Array.isArray(current)) {
            return undefined;
        }

        return (current as Record<string, ExportValue | object | object[] | undefined>)[segment];
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
    decodedPayload: object,
    exporter: ExporterName
): ExporterEntry[] => {
    if (Array.isArray(decodedPayload)) {
        return [];
    }

    const rawExport = (decodedPayload as Record<string, unknown>).export;

    if (Array.isArray(rawExport)) {
        const entries: ExporterEntry[] = [];

        for (let index = 0; index < rawExport.length; index += 1) {
            const element = rawExport[index];
            if (typeof element !== 'object' || element === null || Array.isArray(element)) {
                logger.warn(`Skipping non-record element in export array for exporter=${exporter}, index=${index}`);
                continue;
            }

            const exporterData = (element as Record<string, unknown>)[exporter];
            if (typeof exporterData !== 'object' || exporterData === null || Array.isArray(exporterData)) {
                logger.warn(`Exporter key missing from export array element for exporter=${exporter}, index=${index}`);
                continue;
            }

            entries.push({ exportData: exporterData as Record<string, unknown>, arrayIndex: index });
        }

        return entries;
    }

    if (typeof rawExport !== 'object' || rawExport === null) {
        return [];
    }

    const exporterData = (rawExport as Record<string, unknown>)[exporter];
    if (typeof exporterData !== 'object' || exporterData === null || Array.isArray(exporterData)) {
        return [];
    }

    return [{ exportData: exporterData as Record<string, unknown>, arrayIndex: undefined }];
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
