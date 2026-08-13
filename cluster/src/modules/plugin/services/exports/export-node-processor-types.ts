import type { AnalysisExposureDefinition } from '@shared/contracts/types/http-analysis';
import type { ArtifactUploadBatch } from '@shared/contracts/types/artifact-upload';
import type { JsonObject } from '@shared/contracts/types/json';
import type { JobIdentity } from '@shared/contracts/types/job-identity';
import type { GeometryBudget } from '@shared/domain/octree';
import type { MeshParquetSource } from '@shared/contracts/types/workflow-exposure';
import { PARQUET_SOURCE_KEY } from '@shared/contracts/types/workflow-exposure';

export type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'LineExporter' | 'BondExporter' | 'ChartExporter' | 'ConfigurationExporter' | 'PanelExporter';

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

export interface AtomisticExportOptions {
    /**
     * Colour per category name, declared by the plugin. Categories the plugin does not
     * declare fall back to a generated colour; the daemon never interprets the names.
     */
    propertyColors?: Record<string, [number, number, number, number]>;
    octree?: OctreeExportOptions;
}

export interface MeshExportOptions {
    enableDoubleSided?: boolean;
    /** Flips the winding, matching OVITO's SurfaceMeshVis.reverseOrientation. */
    reverseOrientation?: boolean;
    /**
     * Drops the connected component that encloses all others -- the sample's outer
     * shell -- so interior defects are not hidden behind it. Removes real geometry,
     * so it is meant for a companion artifact rather than the primary one.
     */
    interiorOnly?: boolean;
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

/*
 * Panel blocks, transcribed from `contracts/src/modules/plugin/panel.ts`, which is the
 * source of truth. The daemon cannot import the contracts package — its tsconfig resolves
 * only @core/@modules/@shared — so it re-declares wire shapes, as everything under
 * `shared/contracts/` already does. Keep the field names identical; the resolved document
 * this produces is parsed on the server against the contract version.
 */
export type PanelRgba = [number, number, number, number];
export type PanelScalar = string | number | boolean | null;
export type PanelColumnFormat = 'integer' | 'decimal' | 'percent';

/** Either a literal, or a dotted path to a number the plugin computes per frame. */
export type PanelNumber = number | { source: string };

export interface PanelColumnDeclaration {
    column: string;
    label: string;
    format?: PanelColumnFormat;
}

export interface PanelTableBlockDeclaration {
    kind: 'table';
    title: string;
    source: string;
    label: string;
    columns: PanelColumnDeclaration[];
    colorBy?: string;
    colors?: Record<string, PanelRgba>;
}

export interface PanelCategoricalAxisDeclaration {
    kind: 'categories';
    source: string;
}

export interface PanelIntervalAxisDeclaration {
    kind: 'interval';
    start: PanelNumber;
    end: PanelNumber;
}

export interface PanelChartMarkerDeclaration {
    value: PanelNumber;
    label?: string;
    style?: 'line' | 'zone';
}

export interface PanelChartBlockDeclaration {
    kind: 'chart';
    title: string;
    chartType: 'bar' | 'line';
    values: string;
    x: PanelCategoricalAxisDeclaration | PanelIntervalAxisDeclaration;
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormat?: PanelColumnFormat;
    markers?: PanelChartMarkerDeclaration[];
}

export interface PanelStatBlockDeclaration {
    kind: 'stat';
    title: string;
    source: string;
    format?: PanelColumnFormat;
    unit?: string;
}

export type PanelBlockDeclaration =
    | PanelTableBlockDeclaration
    | PanelChartBlockDeclaration
    | PanelStatBlockDeclaration;

export interface PanelExportOptions {
    blocks: PanelBlockDeclaration[];
    title?: string;
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
