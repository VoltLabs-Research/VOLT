import type { AnalysisExposureDefinition } from '@/modules/analysis/contracts/http.analysis';
import type { ArtifactUploadBatch } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService';

export type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter' | 'ChartExporter';

export interface ExporterEntry {
    exportData: Record<string, unknown>;
    arrayIndex: number | undefined;
}

export interface MeshFacet {
    vertices: [number, number, number];
}

export interface MeshInput {
    vertices: Array<{
        index: number;
        position: [number, number, number];
    }>;
    facets: MeshFacet[];
}

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

export interface ExportExecutionData {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    storageClusterId?: string;
}

export interface ExportExecutionInput {
    executionData: ExportExecutionData;
    exposure: AnalysisExposureDefinition;
    decodedPayload: Record<string, unknown>;
    timestep: number;
    storageClusterId: string;
    artifactUploadBatch: ArtifactUploadBatch;
}
