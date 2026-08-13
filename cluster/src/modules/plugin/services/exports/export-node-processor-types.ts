import type { AnalysisExposureDefinition } from '@shared/contracts/types/http-analysis';
import type { ArtifactUploadBatch } from '@shared/contracts/types/artifact-upload';
import type { JsonObject } from '@shared/contracts/types/json';
import type { JobIdentity } from '@shared/contracts/types/job-identity';
import type { GeometryBudget } from '@shared/domain/octree';
import type { MeshParquetSource } from '@shared/contracts/types/workflow-exposure';
import { PARQUET_SOURCE_KEY } from '@shared/contracts/types/workflow-exposure';

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

interface MeshVertex {
    index: number;
    position: [number, number, number];
}

interface MeshFacet {
    vertices: [number, number, number];
}

export interface InlineMeshInput {
    vertices: MeshVertex[];
    facets: MeshFacet[];
}

interface MeshParquetSourcePayload {
    [PARQUET_SOURCE_KEY]: MeshParquetSource;
}

export type MeshInput = InlineMeshInput | MeshParquetSourcePayload;

const isMeshParquetSource = (value: unknown): value is MeshParquetSource => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Partial<MeshParquetSource>;
    return typeof candidate.vertices === 'string' && typeof candidate.facets === 'string';
};

export const readMeshParquetSource = (exportData: MeshInput): MeshParquetSource | null => {
    const candidate = (exportData as MeshParquetSourcePayload)[PARQUET_SOURCE_KEY];
    return isMeshParquetSource(candidate) ? candidate : null;
};

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

export const ATOMISTIC_PARQUET_SOURCE_KEY = PARQUET_SOURCE_KEY;

interface AtomisticParquetSourcePayload {
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
    /** Flips the winding, matching OVITO's SurfaceMeshVis.reverseOrientation. */
    reverseOrientation?: boolean;
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

type ExportExecutionData = Required<Pick<JobIdentity, 'analysisId' | 'trajectoryId' | 'pluginId'>> & {
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
