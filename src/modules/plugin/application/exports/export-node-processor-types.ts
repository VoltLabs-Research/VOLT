import type { AnalysisExposureDefinition } from '@/modules/analysis/contracts/http-analysis';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';
import type { JsonObject } from '@/support/types/json';
import type { JobIdentity } from '@/support/contracts/job-identity';
import type { GeometryBudget } from '@/shared/octree';

export type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'LineExporter' | 'BondExporter' | 'ChartExporter' | 'ConfigurationExporter';

export type ConfigurationExportFormat = 'lammps-dump' | 'lammps-data' | 'extxyz' | 'poscar' | 'cif';

export interface ConfigurationExporterOptions {
    format: ConfigurationExportFormat;
    // Maps role names to Parquet column names.
    // Required: x, y, z. Optional: type, symbol, vx, vy, vz, fx, fy, fz, q, custom:<name>.
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

// One row of a bond entity table. Like a line entity, a bond carries its
// rendered geometry inline as `points` (exactly two endpoints — the second
// already shifted by the periodic image the bond crosses), so the GLB export is
// self-contained and never joins against the atom table. atom_a / atom_b /
// pbc_shift_* / distance ride along as per-bond property columns.
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
    // Property whose values drive categorical coloring (e.g. burgers_family).
    // Values map through propertyColors; unknown values get a deterministic
    // palette color. When omitted, lines render with the material base color.
    colorBy?: string;
    propertyColors?: Record<string, [number, number, number, number]>;
}

export interface BondExportOptions {
    // Cylinder radius in Angstrom (half the rendered diameter).
    radius?: number;
    tubularSegments?: number;
    material?: ExportMaterial;
    // Per-bond property whose values drive categorical coloring (e.g. a `type`
    // or quantized `bond_order` column); maps through propertyColors with a
    // deterministic palette fallback. Omit for the material base color.
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

// LOD octree bake options. The octree is a metadata sidecar (no geometry of its
// own), staged next to a point-cloud GLB so the client can stream visible-region
// tiles. `enabled` gates the bake so only large point clouds pay for it.
export interface OctreeExportOptions {
    enabled?: boolean;
    // A leaf cell holds at most this many atoms before it subdivides into 8.
    leafCellMaxAtoms?: number;
    maxDepth?: number;
    // Min atoms before the octree is worth baking at all (small clouds render
    // whole). Below this, the export is skipped even when enabled.
    minAtomsForOctree?: number;
    // Render budget embedded in the metadata; the client and geometry-adding
    // features decimate against the same caps the bake assumed. Defaults to the
    // shared DEFAULT_GEOMETRY_BUDGET when omitted.
    geometryBudget?: GeometryBudget;
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
