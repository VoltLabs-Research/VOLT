import { logger } from '@shared/infrastructure/logger';

import { buildObjectPath, resolveExporterEntries } from '@modules/plugin/services/exports/export-node-processor-shared';
import { exportAtomisticArtifact } from '@modules/plugin/services/exports/atomistic-exporter';
import { exportChartArtifact } from '@modules/plugin/services/exports/chart-exporter';
import { exportConfigurationArtifact } from '@modules/plugin/services/exports/configuration-exporter';
import { exportBondArtifact, exportLineArtifact } from '@modules/plugin/services/exports/tube-artifact-exporter';
import { exportMeshArtifact } from '@modules/plugin/services/exports/mesh-exporter';
import type {
    AtomisticExportData,
    BondExportData,
    BondExportOptions,
    ChartExportOptions,
    ConfigurationExportFormat,
    ConfigurationExporterOptions,
    ExportExecutionInput,
    ExporterName,
    LineExportData,
    LineExportOptions,
    MeshExportOptions,
    MeshInput,
    OctreeExportOptions
} from '@modules/plugin/services/exports/export-node-processor-types';
import type { JsonObject } from '@shared/contracts/types/json';
import { isRecord } from '@shared/domain/utilities/is-record';

const CHART_TYPES: ReadonlySet<string> = new Set<ChartExportOptions['chartType']>(['line', 'bar', 'scatter', 'area']);
const CONFIGURATION_FORMATS: ReadonlySet<string> = new Set<ConfigurationExportFormat>(['lammps-dump', 'lammps-data', 'extxyz', 'poscar', 'cif']);

type NarrowedOptions<TOptions> = Record<string, unknown> & TOptions;

const isConfigurationExporterOptions = (
    options: Record<string, unknown>
): options is NarrowedOptions<ConfigurationExporterOptions> => (
    typeof options.format === 'string'
    && CONFIGURATION_FORMATS.has(options.format)
    && Boolean(options.columnMapping)
);

const isChartExportOptions = (
    options: Record<string, unknown>
): options is NarrowedOptions<ChartExportOptions> => (
    typeof options.chartType === 'string' && CHART_TYPES.has(options.chartType)
);

const isEnabledOctreeOptions = (value: unknown): value is OctreeExportOptions =>
    isRecord(value) && value.enabled === true;

const runEntries = async <TExportData>(
    input: ExportExecutionInput,
    exporter: ExporterName,
    type: string,
    run: (exportData: TExportData, objectPath: string) => Promise<unknown>
): Promise<void> => {
    const entries = resolveExporterEntries(input.decodedPayload, exporter);
    for (const { exportData, arrayIndex } of entries) {
        const objectPath = buildObjectPath(input, exporter, type, arrayIndex);
        await run(exportData as TExportData, objectPath);
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
            if (!isChartExportOptions(options)) {
                return;
            }

            await runEntries<JsonObject>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportChartArtifact({
                    ...input,
                    decodedPayload: exportData
                }, objectPath, ownerClusterId, options)
            ));
            return;
        }
        case 'AtomisticExporter': {
            const octreeOptions = isEnabledOctreeOptions(options.octree) ? options.octree : undefined;
            await runEntries<AtomisticExportData>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportAtomisticArtifact(input, exportData, objectPath, ownerClusterId, octreeOptions)
            ));
            return;
        }
        case 'MeshExporter':
            await runEntries<MeshInput>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportMeshArtifact(input, exportData, objectPath, ownerClusterId, options as MeshExportOptions)
            ));
            return;
        case 'LineExporter':
            await runEntries<LineExportData>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportLineArtifact(input, exportData, objectPath, ownerClusterId, options as LineExportOptions)
            ));
            return;
        case 'BondExporter':
            await runEntries<BondExportData>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportBondArtifact(input, exportData, objectPath, ownerClusterId, options as BondExportOptions)
            ));
            return;
        case 'ConfigurationExporter': {
            if (!isConfigurationExporterOptions(options)) {
                logger.warn({ analysisId: input.executionData.analysisId }, 'ConfigurationExporter: invalid or missing options');
                return;
            }
            const objectPath = buildObjectPath(input, exporter, exportConfig.type, undefined);
            await exportConfigurationArtifact(input, options, objectPath, ownerClusterId);
            return;
        }
        default:
            logger.warn(`Unsupported export node exporter on daemon: exporter=${exporter}`);
    }
};
