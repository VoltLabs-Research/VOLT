import type { AnalysisExposureDefinition } from '@/modules/analysis/contracts/http-analysis';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { JsonObject } from '@/support/types/json';
import type { JobIdentity } from '@/support/contracts/job-identity';

export type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'LineExporter' | 'ChartExporter';

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

// One row of a line entity table: fixed id + points, every other key is a
// per-entity property column (string/number scalars or numeric vectors).
export interface LineEntity {
    id: number;
    points: [number, number, number][];
    [property: string]: unknown;
}

export interface LineExportData {
    lines: LineEntity[];
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
    // Property whose values drive categorical coloring (e.g. burgers_family).
    // Values map through propertyColors; unknown values get a deterministic
    // palette color. When omitted, lines render with the material base color.
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

export type ExportExecutionData = Required<Pick<JobIdentity, 'analysisId' | 'trajectoryId' | 'pluginId'>> & {
    storageClusterId?: string;
};

export interface ExportExecutionInput {
    executionData: ExportExecutionData;
    exposure: AnalysisExposureDefinition;
    decodedPayload: JsonObject;
    // Path of the exposure's results Parquet on local disk; line exports upload
    // it as the restyle scene source.
    outputFilePath: string;
    timestep: number;
    storageClusterId: string;
    artifactUploadBatch: ArtifactUploadBatch;
}
