import { logger } from '@/core/logger';
import { isRecord } from '@/support/type-guards/is-record';

import { buildObjectPath, resolveExporterEntries } from '@/modules/plugin/application/exports/export-node-processor-shared';
import { exportAtomisticArtifact } from '@/modules/plugin/application/exports/atomistic-exporter';
import { exportChartArtifact } from '@/modules/plugin/application/exports/chart-exporter';
import { exportDislocationArtifact } from '@/modules/plugin/application/exports/dislocation-exporter';
import { exportMeshArtifact } from '@/modules/plugin/application/exports/mesh-exporter';
import type { ChartExportOptions, DislocationExportOptions, ExportExecutionInput, ExporterName, MeshExportOptions } from '@/modules/plugin/application/exports/export-node-processor-types';

type ExportProcessor = (params: {
    exportConfig: NonNullable<ExportExecutionInput['exposure']['export']>;
    input: ExportExecutionInput;
    ownerClusterId: string;
    options: Record<string, unknown>;
}) => Promise<void>;

type EntryExportRunner = (params: {
    input: ExportExecutionInput;
    exportData: Record<string, unknown>;
    objectPath: string;
    ownerClusterId: string;
    options: Record<string, unknown>;
}) => Promise<boolean>;

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

export class ExportNodeProcessor {
    private readonly processors: Partial<Record<ExporterName, ExportProcessor>>;

    constructor() {
        this.processors = {
            ChartExporter: async ({ exportConfig, input, ownerClusterId, options }) => {
                const chartOptions = readChartExportOptions(options);
                if (!chartOptions) {
                    return;
                }

                const objectPath = buildObjectPath(input, 'ChartExporter', exportConfig.type);
                const exported = await exportChartArtifact(input, objectPath, ownerClusterId, chartOptions);
            },
            AtomisticExporter: (params) => this.processEntries('AtomisticExporter', params, ({ input, exportData, objectPath, ownerClusterId }) => {
                return exportAtomisticArtifact(
                    input,
                    exportData,
                    objectPath,
                    ownerClusterId
                );
            }),
            MeshExporter: (params) => this.processEntries('MeshExporter', params, ({ input, exportData, objectPath, ownerClusterId, options }) => {
                return exportMeshArtifact(
                    input,
                    exportData,
                    objectPath,
                    ownerClusterId,
                    options as MeshExportOptions
                );
            }),
            DislocationExporter: (params) => this.processEntries('DislocationExporter', params, ({ input, exportData, objectPath, ownerClusterId, options }) => {
                return exportDislocationArtifact(
                    input,
                    exportData,
                    objectPath,
                    ownerClusterId,
                    options as DislocationExportOptions
                );
            })
        };
    }

    async process(input: ExportExecutionInput): Promise<void> {
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

        const processExport = this.processors[exporter];
        if (!processExport) {
            logger.warn(`Unsupported export node exporter on daemon: exporter=${exporter}`);
            return;
        }

        await processExport({
            exportConfig,
            input,
            ownerClusterId,
            options
        });
    }

    private async processEntries(
        exporter: ExporterName,
        params: {
            exportConfig: NonNullable<ExportExecutionInput['exposure']['export']>;
            input: ExportExecutionInput;
            ownerClusterId: string;
            options: Record<string, unknown>;
        },
        run: EntryExportRunner
    ): Promise<void> {
        const entries = resolveExporterEntries(params.input.decodedPayload, exporter);
        if (entries.length === 0) {
            return;
        }

        for (const { exportData, arrayIndex } of entries) {
            const objectPath = buildObjectPath(params.input, exporter, params.exportConfig.type, arrayIndex);
            const exported = await run({
                input: params.input,
                exportData,
                objectPath,
                ownerClusterId: params.ownerClusterId,
                options: params.options
            });
        }
    }
}
