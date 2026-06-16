import type { AnalysisExposureDefinition } from '@/modules/analysis/contracts/http-analysis';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { JsonObject } from '@/support/types/json';
import type { JobIdentity } from '@/support/contracts/job-identity';
import type { GeometryBudget } from '@/shared/octree';

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

export interface BondEntity {
    id: number;
    points: [number, number, number][];
    [property: string]: unknown;
}

export interface BondExportData {
    bonds: BondEntity[];
}

export interface AtomisticAtom {
    pos: [number, number, number];
    color?: [number, number, number] | [number, number, number, number];
    structure_color?: [number, number, number] | [number, number, number, number];
    rgb?: [number, number, number] | [number, number, number, number];
    base_color?: [number, number, number] | [number, number, number, number];
}

export type AtomisticExportData = Record<string, AtomisticAtom[]>;

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
