import { logger } from '@/core/logger';
import type { NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';

import { buildObjectPath, ChartExportOptions, DislocationExportOptions, ExportExecutionInput, ExporterName, MeshExportOptions, isRecord, logSkippedEmptyExport, resolveExporterEntries } from '@/modules/plugin/application/exports/ExportNodeProcessor.shared';
import { exportAtomisticArtifact } from '@/modules/plugin/application/exports/ExportNodeAtomisticExporter';
import { exportChartArtifact } from '@/modules/plugin/application/exports/ExportNodeChartExporter';
import { exportDislocationArtifact } from '@/modules/plugin/application/exports/ExportNodeDislocationExporter';
import { exportMeshArtifact } from '@/modules/plugin/application/exports/ExportNodeMeshExporter';

const readChartExportOptions = (options: Record<string, unknown>): ChartExportOptions | null => {
    if (
        typeof options.xAxisKey !== 'string'
        || typeof options.yAxisKey !== 'string'
        || !['line', 'bar', 'scatter', 'area'].includes(String(options.chartType))
    ) {
        return null;
    }

    return options as unknown as ChartExportOptions;
};

export interface ExportNodeProcessorService {
    process(input: ExportExecutionInput): Promise<void>;
}

export const createExportNodeProcessorService = (
    nativeModuleLoader: NativeModuleLoader
): ExportNodeProcessorService => {
    return {
        async process(input) {
            const exportConfig = input.exposure.export;
            if (!exportConfig) {
                return;
            }

            const ownerClusterId = input.storageClusterId;
            if (!ownerClusterId) {
                throw new Error(`Missing storage owner cluster for analysis export ${input.executionData.analysisId}`);
            }

            const exporter = exportConfig.exporter as ExporterName;
            const options = isRecord(exportConfig.options)
                ? exportConfig.options
                : {};

            if (exporter === 'ChartExporter') {
                const chartOptions = readChartExportOptions(options);
                if (!chartOptions) {
                    logSkippedEmptyExport(input, exporter, 'chart export options are invalid');
                    return;
                }

                const objectPath = buildObjectPath(input, exporter, exportConfig.type);
                const exported = await exportChartArtifact(
                    input,
                    objectPath,
                    ownerClusterId,
                    chartOptions
                );
                if (!exported) {
                    logSkippedEmptyExport(input, exporter, 'chart payload had no rows');
                }
                return;
            }

            const entries = resolveExporterEntries(input.decodedPayload, exporter);
            if (entries.length === 0) {
                logSkippedEmptyExport(input, exporter, 'exposure payload did not include exportable data');
                return;
            }

            for (const { exportData, arrayIndex } of entries) {
                const objectPath = buildObjectPath(input, exporter, exportConfig.type, arrayIndex);
                let exported = false;

                switch (exporter) {
                    case 'AtomisticExporter':
                        exported = await exportAtomisticArtifact(
                            nativeModuleLoader,
                            input,
                            exportData,
                            objectPath,
                            ownerClusterId
                        );
                        break;
                    case 'MeshExporter':
                        exported = await exportMeshArtifact(
                            nativeModuleLoader,
                            input,
                            exportData,
                            objectPath,
                            ownerClusterId,
                            options as MeshExportOptions
                        );
                        break;
                    case 'DislocationExporter':
                        exported = await exportDislocationArtifact(
                            nativeModuleLoader,
                            input,
                            exportData,
                            objectPath,
                            ownerClusterId,
                            options as DislocationExportOptions
                        );
                        break;
                    default:
                        logger.warn({ exporter }, 'Unsupported export node exporter on daemon');
                        return;
                }

                if (!exported) {
                    logSkippedEmptyExport(
                        input,
                        exporter,
                        'export data was present but contained no results',
                        arrayIndex
                    );
                }
            }
        }
    };
};
