import type { AnalysisExposureDefinition } from '@shared/contracts/types/http-analysis';
import type { ArtifactUploadBatch } from '@shared/contracts/types/artifact-upload';
import type { JsonObject } from '@shared/contracts/types/json';
import type { JobIdentity } from '@shared/contracts/types/job-identity';
import type { GeometryBudget } from '@shared/domain/octree';

export type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'LineExporter' | 'BondExporter' | 'ChartExporter' | 'ConfigurationExporter';

export type ConfigurationExportFormat = 'lammps-dump' | 'lammps-data' | 'extxyz' | 'poscar' | 'cif';

export interface ConfigurationExporterOptions {
    format: ConfigurationExportFormat;
    columnMapping: Record<string, string>;
    aseWriteKwargs?: Record<string, unknown>;
}

export interface ExporterEntry {
    exportData: JsonObject;
    arrayIndex: number | undefined;
}

export interface MeshVertex {
    index: number;
    position: [number, number, number];
}

export interface MeshFacet {
    vertices: [number, number, number];
}

export interface MeshInput {
    vertices: MeshVertex[];
    facets: MeshFacet[];
}

export interface LineEntity {
    id: number;
    points: [number, number, number][];
    [property: string]: unknown;
}

export interface LineExportData {
    lines: LineEntity[];
}

export interface BondExportData {
    bonds: LineEntity[];
}

export interface AtomisticAtom {
    pos: [number, number, number];
    color?: [number, number, number] | [number, number, number, number];
    structure_color?: [number, number, number] | [number, number, number, number];
    rgb?: [number, number, number] | [number, number, number, number];
    base_color?: [number, number, number] | [number, number, number, number];
}

/**
 * Key under which an atomistic payload carries the parquet it was derived from,
 * instead of an inline atom list. Lets the exporter stream positions columnar for
 * frames whose atom count makes a JS array untenable.
 */
export const ATOMISTIC_PARQUET_SOURCE_KEY = '__parquet_source__';

export interface AtomisticParquetSourcePayload {
    [ATOMISTIC_PARQUET_SOURCE_KEY]: string;
}

export type AtomisticExportData = Record<string, AtomisticAtom[]> | AtomisticParquetSourcePayload;

export const readAtomisticParquetSource = (exportData: AtomisticExportData): string | null => {
    const candidate = (exportData as AtomisticParquetSourcePayload)[ATOMISTIC_PARQUET_SOURCE_KEY];
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
};

export interface ExportMaterial {
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
}

export interface MeshExportOptions {
    enableDoubleSided?: boolean;
    smoothIterations?: number;
    material?: ExportMaterial;
}

export interface LineExportOptions {
    lineWidth?: number;
    tubularSegments?: number;
    minSegmentPoints?: number;
    material?: ExportMaterial;
    colorBy?: string;
    propertyColors?: Record<string, [number, number, number, number]>;
}

export interface BondExportOptions {
    radius?: number;
    tubularSegments?: number;
    material?: ExportMaterial;
    colorBy?: string;
    propertyColors?: Record<string, [number, number, number, number]>;
}

export interface ChartExportOptions {
    xAxisKey: string;
    yAxisKey: string;
    chartType: 'line' | 'bar' | 'scatter' | 'area';
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
    lineColor?: string;
    fillColor?: string;
    showLegend?: boolean;
    showGrid?: boolean;
}

export interface OctreeExportOptions {
    enabled?: boolean;
    leafCellMaxAtoms?: number;
    maxDepth?: number;
    minAtomsForOctree?: number;
    geometryBudget?: GeometryBudget;
}

export type ExportExecutionData = Required<Pick<JobIdentity, 'analysisId' | 'trajectoryId' | 'pluginId'>> & {
    storageClusterId?: string;
};

export interface ExportExecutionInput {
    executionData: ExportExecutionData;
    exposure: AnalysisExposureDefinition;
    decodedPayload: JsonObject;
    outputFilePath: string;
    timestep: number;
    storageClusterId: string;
    artifactUploadBatch: ArtifactUploadBatch;
}
