import { logger } from '@/core/logger';

import { buildObjectPath, resolveExporterEntries } from '@/modules/plugin/application/exports/export-node-processor-shared';
import { exportAtomisticArtifact } from '@/modules/plugin/application/exports/atomistic-exporter';
import { exportChartArtifact } from '@/modules/plugin/application/exports/chart-exporter';
import { exportConfigurationArtifact } from '@/modules/plugin/application/exports/configuration-exporter';
import { exportLineArtifact } from '@/modules/plugin/application/exports/line-exporter';
import { exportBondArtifact } from '@/modules/plugin/application/exports/bond-exporter';
import { exportMeshArtifact } from '@/modules/plugin/application/exports/mesh-exporter';
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
} from '@/modules/plugin/application/exports/export-node-processor-types';
import type { JsonObject } from '@/support/types/json';

const CHART_TYPES = new Set(['line', 'bar', 'scatter', 'area']);
const CONFIGURATION_FORMATS = new Set<ConfigurationExportFormat>(['lammps-dump', 'lammps-data', 'extxyz', 'poscar', 'cif']);

const narrowConfigurationExporterOptions = (options: Record<string, unknown>): ConfigurationExporterOptions | null => {
    const fmt = options.format;
    if (typeof fmt !== 'string' || !CONFIGURATION_FORMATS.has(fmt as ConfigurationExportFormat)) {
        return null;
    }
    const cm = options.columnMapping;
    if (typeof cm !== 'object' || cm === null || Array.isArray(cm)) {
        return null;
    }
    return {
        format: fmt as ConfigurationExportFormat,
        columnMapping: cm as Record<string, string>,
        aseWriteKwargs: typeof options.aseWriteKwargs === 'object' && options.aseWriteKwargs !== null
            ? options.aseWriteKwargs as Record<string, unknown>
            : undefined
    };
};

// The octree bake is opt-in via the AtomisticExporter's `octree` option block.
// Plugin JSON is untyped at the wire; this narrows it to OctreeExportOptions
// (not a redundant re-validation of an already-typed value — it crosses the
// JSON boundary, like the other narrow* helpers here). Returns undefined when
// absent or disabled so the exporter skips the bake.
const narrowOctreeOptions = (raw: unknown): OctreeExportOptions | undefined => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return undefined;
    }
    const o = raw as Record<string, unknown>;
    if (o.enabled !== true) {
        return undefined;
    }
    return {
        enabled: true,
        leafCellMaxAtoms: typeof o.leafCellMaxAtoms === 'number' ? o.leafCellMaxAtoms : undefined,
        maxDepth: typeof o.maxDepth === 'number' ? o.maxDepth : undefined,
        minAtomsForOctree: typeof o.minAtomsForOctree === 'number' ? o.minAtomsForOctree : undefined,
        geometryBudget: typeof o.geometryBudget === 'object' && o.geometryBudget !== null && !Array.isArray(o.geometryBudget)
            ? (o.geometryBudget as OctreeExportOptions['geometryBudget'])
            : undefined
    };
};

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
        case 'AtomisticExporter': {
            const octreeOptions = narrowOctreeOptions(options.octree);
            await runEntries(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportAtomisticArtifact(input, exportData as unknown as AtomisticExportData, objectPath, ownerClusterId, octreeOptions)
            ));
            return;
        }
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
        case 'BondExporter':
            await runEntries(input, exporter, exportConfig.type, (exportData, objectPath) => (
                exportBondArtifact(input, exportData as unknown as BondExportData, objectPath, ownerClusterId, options as BondExportOptions)
            ));
            return;
        case 'ConfigurationExporter': {
            const cfgOpts = narrowConfigurationExporterOptions(options);
            if (!cfgOpts) {
                logger.warn({ analysisId: input.executionData.analysisId }, 'ConfigurationExporter: invalid or missing options');
                return;
            }
            const objectPath = buildObjectPath(input, exporter, exportConfig.type, undefined);
            await exportConfigurationArtifact(input, cfgOpts, objectPath, ownerClusterId);
            return;
        }
        default:
            logger.warn(`Unsupported export node exporter on daemon: exporter=${exporter}`);
    }
};
