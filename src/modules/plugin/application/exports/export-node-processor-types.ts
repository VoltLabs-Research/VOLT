import type { AnalysisExposureDefinition } from '@/modules/analysis/contracts/http-analysis';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { JsonObject } from '@/support/types/json';
import type { JobIdentity } from '@/support/contracts/job-identity';

export type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter' | 'ChartExporter';

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

export interface DislocationSegment {
    points: [number, number, number][];
    segment_id?: number;
    length?: number;
    num_points?: number;
    magnitude?: number;
    burgers_vector?: [number, number, number];
    burgers_vector_local?: [number, number, number];
    burgers_vector_global?: [number, number, number];
    crystal_structure?: string;
    burgers_family?: string;
    burgers_family_label?: string;
}

export interface DislocationExportData {
    segments: DislocationSegment[];
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

export interface DislocationExportOptions {
    lineWidth?: number;
    tubularSegments?: number;
    minSegmentPoints?: number;
    material?: ExportMaterial;
    colorByType?: boolean;
    typeColors?: Record<string, [number, number, number, number]>;
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
    timestep: number;
    storageClusterId: string;
    artifactUploadBatch: ArtifactUploadBatch;
}
