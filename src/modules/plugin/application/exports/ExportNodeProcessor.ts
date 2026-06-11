import { logger } from '@/core/logger';

import { buildObjectPath, resolveExporterEntries } from '@/modules/plugin/application/exports/export-node-processor-shared';
import { exportAtomisticArtifact } from '@/modules/plugin/application/exports/atomistic-exporter';
import { exportChartArtifact } from '@/modules/plugin/application/exports/chart-exporter';
import { exportLineArtifact } from '@/modules/plugin/application/exports/line-exporter';
import { exportMeshArtifact } from '@/modules/plugin/application/exports/mesh-exporter';
import type {
    AtomisticExportData,
    ChartExportOptions,
    ExportExecutionInput,
    ExporterName,
    LineExportData,
    LineExportOptions,
    MeshExportOptions,
    MeshInput
} from '@/modules/plugin/application/exports/export-node-processor-types';
import type { JsonObject } from '@/support/types/json';

const CHART_TYPES = new Set(['line', 'bar', 'scatter', 'area']);

const narrowChartOptions = (options: Record<string, unknown>): ChartExportOptions | null => {
    if (
        typeof options.xAxisKey !== 'string'
        || typeof options.yAxisKey !== 'string'
        || typeof options.chartType !== 'string'
        || !CHART_TYPES.has(options.chartType)
    ) {
        return null;
    }

    return options as unknown as ChartExportOptions;
};

const runEntries = async (
    input: ExportExecutionInput,
    exporter: ExporterName,
    type: string,
    run: (exportData: JsonObject, objectPath: string) => Promise<unknown>
): Promise<void> => {
    const entries = resolveExporterEntries(input.decodedPayload, exporter);
    for (const { exportData, arrayIndex } of entries) {
        const objectPath = buildObjectPath(input, exporter, type, arrayIndex);
        await run(exportData, objectPath);
    }
};

export const processExportNode = async (input: ExportExecutionInput): Promise<void> => {
    const exportConfig = input.exposure.export;
    if (!exportConfig) {
        return;
    }

    const ownerClusterId = input.storageClusterId;
    if (!ownerClusterId) {
        throw new Error(`Missing storage owner cluster for analysis export ${input.executionData.analysisId}`);
    }

    const options = (exportConfig.options ?? {}) as Record<string, unknown>;
    const exporter = exportConfig.exporter as ExporterName;

    switch (exporter) {
        case 'ChartExporter': {
            const chartOptions = narrowChartOptions(options);
            if (!chartOptions) {
                return;
            }

            await runEntries(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportChartArtifact({
                    ...input,
                    decodedPayload: exportData
                }, objectPath, ownerClusterId, chartOptions)
            ));
            return;
        }
        case 'AtomisticExporter':
            await runEntries(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportAtomisticArtifact(input, exportData as unknown as AtomisticExportData, objectPath, ownerClusterId)
            ));
            return;
        case 'MeshExporter':
            await runEntries(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportMeshArtifact(input, exportData as unknown as MeshInput, objectPath, ownerClusterId, options as MeshExportOptions)
            ));
            return;
        case 'LineExporter':
            await runEntries(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportLineArtifact(input, exportData as unknown as LineExportData, objectPath, ownerClusterId, options as LineExportOptions)
            ));
            return;
        default:
            logger.warn(`Unsupported export node exporter on daemon: exporter=${exporter}`);
    }
};
