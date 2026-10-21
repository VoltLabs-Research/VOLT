import { buildEmptyMeshGlb, buildMeshGlb, computeBounds } from './glb';
import { dropEnclosingComponent } from './mesh-component-filter';
import { clipMeshToPeriodicCell } from './mesh-periodic-clipping';
import { PARQUET_SOURCE_KEY } from './types';
import type { MeshMaterial } from './glb';
import type { ShimTable } from '../shim-table';
import type { ExportMaterial, MeshDomain, MeshExportOptions, Rgba, Vec3 } from './types';

// Port of the cluster's MeshExporter (mesh-exporter.ts) plus spatial-assembler's taubinSmooth.

interface MeshParquetSource {
    vertices: string;
    facets: string;
    cell?: MeshDomain;
}

interface InlineMeshInput {
    vertices: Array<{ index: number; position: Vec3 }>;
    facets: Array<{ vertices: Vec3 }>;
}

const DEFAULT_MESH_MATERIAL: ExportMaterial = {
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 1,
    emissive: [0, 0, 0]
};
const DEFAULT_MESH_SMOOTH_ITERATIONS = 8;
const MAX_MESH_SMOOTH_ITERATIONS = 50;
const CAP_COLOR: Readonly<Rgba> = [0.8, 0.8, 1.0, 1.0];
const SURFACE_COLOR: Readonly<Rgba> = [1, 1, 1, 1];
const TAUBIN_LAMBDA = Math.fround(0.5);
const TAUBIN_MU = Math.fround(-0.52);

const resolveSmoothIterations = (requested: number | undefined): number => {
    if (requested === undefined) {
        return DEFAULT_MESH_SMOOTH_ITERATIONS;
    }
    if (!Number.isFinite(requested) || requested <= 0) {
        return 0;
    }
    return Math.min(Math.round(requested), MAX_MESH_SMOOTH_ITERATIONS);
};

const averageNeighbors = (source: Float32Array, neighbors: number[], target: Float32Array, vertex: number, factor: number) => {
    const base = vertex * 3;
    if (neighbors.length === 0) {
        target[base] = source[base];
        target[base + 1] = source[base + 1];
        target[base + 2] = source[base + 2];
        return;
    }
    let avgX = 0;
    let avgY = 0;
    let avgZ = 0;
    for (const neighbor of neighbors) {
        avgX = Math.fround(avgX + source[neighbor * 3]);
        avgY = Math.fround(avgY + source[neighbor * 3 + 1]);
        avgZ = Math.fround(avgZ + source[neighbor * 3 + 2]);
    }
    const inverse = Math.fround(1 / neighbors.length);
    avgX = Math.fround(avgX * inverse);
    avgY = Math.fround(avgY * inverse);
    avgZ = Math.fround(avgZ * inverse);
    target[base] = source[base] + Math.fround(factor * Math.fround(avgX - source[base]));
    target[base + 1] = source[base + 1] + Math.fround(factor * Math.fround(avgY - source[base + 1]));
    target[base + 2] = source[base + 2] + Math.fround(factor * Math.fround(avgZ - source[base + 2]));
};

// Same float32 arithmetic as spatial-assembler's TaubinSmooth (lambda 0.5, mu -0.52), in place.
const taubinSmooth = (positions: Float32Array, indices: Uint32Array, iterations: number) => {
    const vertexCount = positions.length / 3;
    const adjacency: number[][] = Array.from({ length: vertexCount }, () => []);
    for (let index = 0; index + 2 < indices.length; index += 3) {
        const [v0, v1, v2] = [indices[index], indices[index + 1], indices[index + 2]];
        adjacency[v0].push(v1, v2);
        adjacency[v1].push(v0, v2);
        adjacency[v2].push(v0, v1);
    }
    const neighbors = adjacency.map((list) => Array.from(new Set(list)).sort((left, right) => left - right));

    const temp = new Float32Array(positions.length);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        for (let vertex = 0; vertex < vertexCount; vertex += 1) {
            averageNeighbors(positions, neighbors[vertex], temp, vertex, TAUBIN_LAMBDA);
        }
        for (let vertex = 0; vertex < vertexCount; vertex += 1) {
            averageNeighbors(temp, neighbors[vertex], positions, vertex, TAUBIN_MU);
        }
    }
};

const computeNormals = (positions: Float32Array, indices: Uint32Array): Float32Array => {
    const normals = new Float32Array(positions.length);

    for (let index = 0; index < indices.length; index += 3) {
        const ia = indices[index] * 3;
        const ib = indices[index + 1] * 3;
        const ic = indices[index + 2] * 3;

        const abx = positions[ib] - positions[ia];
        const aby = positions[ib + 1] - positions[ia + 1];
        const abz = positions[ib + 2] - positions[ia + 2];
        const acx = positions[ic] - positions[ia];
        const acy = positions[ic + 1] - positions[ia + 1];
        const acz = positions[ic + 2] - positions[ia + 2];

        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;

        for (const corner of [ia, ib, ic]) {
            normals[corner] += nx;
            normals[corner + 1] += ny;
            normals[corner + 2] += nz;
        }
    }

    for (let index = 0; index < normals.length; index += 3) {
        const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]) || 1;
        normals[index] /= length;
        normals[index + 1] /= length;
        normals[index + 2] /= length;
    }

    return normals;
};

const reverseWinding = (indices: Uint32Array): void => {
    for (let index = 0; index + 2 < indices.length; index += 3) {
        const second = indices[index + 1];
        indices[index + 1] = indices[index + 2];
        indices[index + 2] = second;
    }
};

// Cap triangles get their own vertices so they can carry the cap color.
const separateCapVertices = (positions: Float32Array, indices: Uint32Array, surfaceTriangleCount: number) => {
    const surfaceIndexCount = surfaceTriangleCount * 3;
    const capIndexCount = indices.length - surfaceIndexCount;
    const baseVertexCount = positions.length / 3;

    const nextPositions = new Float32Array(positions.length + capIndexCount * 3);
    nextPositions.set(positions);
    const nextIndices = new Uint32Array(indices.length);
    nextIndices.set(indices.subarray(0, surfaceIndexCount));
    const colors = new Float32Array((baseVertexCount + capIndexCount) * 4);

    for (let vertex = 0; vertex < baseVertexCount; vertex += 1) {
        colors.set(SURFACE_COLOR, vertex * 4);
    }

    for (let offset = 0; offset < capIndexCount; offset += 1) {
        const source = indices[surfaceIndexCount + offset];
        const target = baseVertexCount + offset;
        nextPositions[target * 3] = positions[source * 3];
        nextPositions[target * 3 + 1] = positions[source * 3 + 1];
        nextPositions[target * 3 + 2] = positions[source * 3 + 2];
        colors.set(CAP_COLOR, target * 4);
        nextIndices[surfaceIndexCount + offset] = target;
    }

    return { positions: nextPositions, indices: nextIndices, colors };
};

interface FinishMeshOptions {
    smoothIterations: number;
    reverseOrientation: boolean;
    interiorOnly: boolean;
    cell: MeshDomain | null;
}

const finishMesh = (positions: Float32Array, indices: Uint32Array, options: FinishMeshOptions) => {
    if (options.smoothIterations > 0) {
        taubinSmooth(positions, indices, options.smoothIterations);
    }
    if (options.reverseOrientation) {
        reverseWinding(indices);
    }

    let workingPositions = positions;
    let workingIndices = indices;
    let colors: Float32Array | undefined;

    if (options.interiorOnly) {
        const filtered = dropEnclosingComponent(workingPositions, workingIndices);
        workingPositions = filtered.positions;
        workingIndices = filtered.indices;
    }

    if (options.cell) {
        const clipped = clipMeshToPeriodicCell(workingPositions, workingIndices, options.cell);
        if (clipped) {
            workingPositions = clipped.positions;
            workingIndices = clipped.indices;
            if (clipped.capTriangleCount > 0) {
                const separated = separateCapVertices(clipped.positions, clipped.indices, clipped.surfaceTriangleCount);
                workingPositions = separated.positions;
                workingIndices = separated.indices;
                colors = separated.colors;
            }
        }
    }

    return {
        positions: workingPositions,
        normals: computeNormals(workingPositions, workingIndices),
        indices: workingIndices,
        colors,
        bounds: computeBounds(workingPositions)
    };
};

const columnIndex = (table: ShimTable, name: string): number =>
    table.columns.findIndex((column) => column.name === name);

// Mirrors processMeshFromParquet: vertices in slot order, facets joined to slots through vertex_id.
const meshFromTables = (vertices: ShimTable, facets: ShimTable): { positions: Float32Array; indices: Uint32Array } | null => {
    const [slot, vertexId, x, y, z] = ['slot', 'vertex_id', 'x', 'y', 'z'].map((name) => columnIndex(vertices, name));
    const [order, a, b, c] = ['ord', 'a', 'b', 'c'].map((name) => columnIndex(facets, name));
    if (vertices.rows.length === 0 || facets.rows.length === 0 || [slot, vertexId, x, y, z, a, b, c].includes(-1)) {
        return null;
    }

    const vertexRows = [...vertices.rows].sort((left, right) => Number(left[slot]) - Number(right[slot]));
    const positions = new Float32Array(vertexRows.length * 3);
    const slotByVertexId = new Map<number, number>();
    vertexRows.forEach((row, index) => {
        positions[index * 3] = Number(row[x] ?? 0);
        positions[index * 3 + 1] = Number(row[y] ?? 0);
        positions[index * 3 + 2] = Number(row[z] ?? 0);
        if (row[vertexId] !== null && row[vertexId] !== undefined) {
            const id = Number(row[vertexId]);
            slotByVertexId.set(id, Math.max(slotByVertexId.get(id) ?? -Infinity, Number(row[slot])));
        }
    });

    const facetRows = order < 0 ? facets.rows : [...facets.rows].sort((left, right) => Number(left[order]) - Number(right[order]));
    const triangles: number[] = [];
    for (const row of facetRows) {
        const corners = [a, b, c].map((column) => slotByVertexId.get(Number(row[column])));
        if (corners.every((corner): corner is number => corner !== undefined)) {
            triangles.push(...corners);
        }
    }

    return triangles.length > 0 ? { positions, indices: Uint32Array.from(triangles) } : null;
};

const meshFromInline = (mesh: InlineMeshInput): { positions: Float32Array; indices: Uint32Array } | null => {
    if (!Array.isArray(mesh.vertices) || !Array.isArray(mesh.facets) || mesh.vertices.length === 0 || mesh.facets.length === 0) {
        return null;
    }

    const positions = new Float32Array(mesh.vertices.length * 3);
    const vertexIndices = new Map<number, number>();
    mesh.vertices.forEach((vertex, index) => {
        positions.set(vertex.position, index * 3);
        vertexIndices.set(vertex.index, index);
    });

    const triangles: number[] = [];
    for (const facet of mesh.facets) {
        const corners = facet.vertices.map((vertex) => vertexIndices.get(vertex));
        if (corners.every((corner): corner is number => corner !== undefined)) {
            triangles.push(...corners);
        }
    }
    return triangles.length > 0 ? { positions, indices: Uint32Array.from(triangles) } : null;
};

const readParquetSource = (exportData: Record<string, unknown>): MeshParquetSource | null => {
    const candidate = exportData[PARQUET_SOURCE_KEY] as Partial<MeshParquetSource> | undefined;
    return typeof candidate?.vertices === 'string' && typeof candidate.facets === 'string'
        ? candidate as MeshParquetSource
        : null;
};

// readTable resolves a file the plugin wrote next to the exposure (the parquet source references them by name).
export const exportMesh = (
    exportData: Record<string, unknown>,
    options: MeshExportOptions,
    readTable: (fileName: string) => ShimTable | null
): Blob => {
    const material: MeshMaterial = {
        ...DEFAULT_MESH_MATERIAL,
        ...options.material,
        doubleSided: options.enableDoubleSided ?? true
    };
    const source = readParquetSource(exportData);
    const finishOptions: FinishMeshOptions = {
        smoothIterations: resolveSmoothIterations(options.smoothIterations),
        reverseOrientation: options.reverseOrientation ?? false,
        interiorOnly: options.interiorOnly ?? false,
        cell: source?.cell ?? null
    };

    let mesh: { positions: Float32Array; indices: Uint32Array } | null = null;
    if (source) {
        const vertices = readTable(source.vertices);
        const facets = readTable(source.facets);
        mesh = vertices && facets ? meshFromTables(vertices, facets) : null;
    } else {
        mesh = meshFromInline(exportData as unknown as InlineMeshInput);
    }
    if (!mesh) {
        return buildEmptyMeshGlb(material);
    }

    return buildMeshGlb(finishMesh(mesh.positions, mesh.indices, finishOptions), material);
};
