import { logger } from '@shared/infrastructure/logger';

import { buildObjectPath, resolveExporterEntries } from '@modules/plugin/services/exports/export-node-processor-shared';
import { exportAtomisticArtifact } from '@modules/plugin/services/exports/atomistic-exporter';
import { exportChartArtifact } from '@modules/plugin/services/exports/chart-exporter';
import { exportConfigurationArtifact } from '@modules/plugin/services/exports/configuration-exporter';
import { exportBondArtifact, exportLineArtifact } from '@modules/plugin/services/exports/tube-artifact-exporter';
import { exportMeshArtifact } from '@modules/plugin/services/exports/mesh-exporter';
import type {
    AtomisticExportData,
    AtomisticExportOptions,
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

const exportContext = (input: ExportExecutionInput, exporter: ExporterName) => ({
    analysisId: input.executionData.analysisId,
    exposure: input.exposure.name,
    exposureId: input.exposure.nodeId,
    timestep: input.timestep,
    exporter
});

/**
 * Resolves to `true` when at least one artifact was staged for upload. Every
 * exporter can legitimately produce nothing (no geometry, no chart points), and
 * the caller has to know: an exposure that emitted nothing has no upload coming,
 * so its expected artifact would otherwise wait forever.
 */
const runEntries = async <TExportData>(
    input: ExportExecutionInput,
    exporter: ExporterName,
    type: string,
    run: (exportData: TExportData, objectPath: string) => Promise<boolean>
): Promise<boolean> => {
    const entries = resolveExporterEntries(input.decodedPayload, exporter);
    if (entries.length === 0) {
        logger.warn(
            exportContext(input, exporter),
            'Export node produced nothing: payload carries no data for this exporter'
        );
        return false;
    }

    let produced = false;
    for (const { exportData, arrayIndex } of entries) {
        const objectPath = buildObjectPath(input, exporter, type, arrayIndex);
        if (await run(exportData as TExportData, objectPath)) {
            produced = true;
            continue;
        }

        logger.warn(
            {
                ...exportContext(input, exporter),
                arrayIndex
            },
            'Export node entry produced nothing: exporter found no exportable data'
        );
    }

    return produced;
};

export const processExportNode = async (input: ExportExecutionInput): Promise<boolean> => {
    const exportConfig = input.exposure.export;
    if (!exportConfig) {
        return false;
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
                logger.warn(exportContext(input, exporter), 'ChartExporter: invalid or missing options');
                return false;
            }

            return runEntries<JsonObject>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportChartArtifact({
                    ...input,
                    decodedPayload: exportData
                }, objectPath, ownerClusterId, options)
            ));
        }
        case 'AtomisticExporter': {
            const octreeOptions = isEnabledOctreeOptions(options.octree) ? options.octree : undefined;
            return runEntries<AtomisticExportData>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportAtomisticArtifact(
                    input,
                    exportData,
                    objectPath,
                    ownerClusterId,
                    octreeOptions,
                    options as AtomisticExportOptions
                )
            ));
        }
        case 'MeshExporter':
            return runEntries<MeshInput>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportMeshArtifact(input, exportData, objectPath, ownerClusterId, options as MeshExportOptions)
            ));
        case 'LineExporter':
            return runEntries<LineExportData>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportLineArtifact(input, exportData, objectPath, ownerClusterId, options as LineExportOptions)
            ));
        case 'BondExporter':
            return runEntries<BondExportData>(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportBondArtifact(input, exportData, objectPath, ownerClusterId, options as BondExportOptions)
            ));
        case 'ConfigurationExporter': {
            if (!isConfigurationExporterOptions(options)) {
                logger.warn(exportContext(input, exporter), 'ConfigurationExporter: invalid or missing options');
                return false;
            }
            const objectPath = buildObjectPath(input, exporter, exportConfig.type, undefined);
            await exportConfigurationArtifact(input, options, objectPath, ownerClusterId);
            return true;
        }
        default:
            logger.warn(`Unsupported export node exporter on daemon: exporter=${exporter}`);
            return false;
    }
};
