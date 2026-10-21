import { resolveCategoryColors } from './category-colors';
import { buildEmptyMeshGlb, buildMeshGlb } from './glb';
import type { MeshMaterial } from './glb';
import type { BondExportOptions, ExportMaterial, LineEntity, LineExportOptions, Rgba, Vec3 } from './types';

// Port of the cluster's LineExporter / BondExporter (line-exporter.ts, line-tube-geometry.ts,
// tube-artifact-exporter.ts): every polyline becomes a tube with one color per entity.

const MAX_LINE_VERTICES = 5_000_000;
const FALLBACK_LINE_COLOR: Rgba = [0.9, 0.2, 0.2, 1];

interface ResolvedLineOptions {
    lineWidth: number;
    tubularSegments: number;
    minSegmentPoints: number;
    material: ExportMaterial;
    colorBy: string;
    propertyColors: Record<string, Rgba>;
}

const DEFAULT_LINE_OPTIONS: ResolvedLineOptions = {
    lineWidth: 0.08,
    tubularSegments: 12,
    minSegmentPoints: 2,
    material: {
        baseColor: [1, 1, 1, 1],
        metallic: 0.1,
        roughness: 0.3,
        emissive: [0, 0, 0]
    },
    colorBy: '',
    propertyColors: {}
};

const DEFAULT_BOND_RADIUS = 0.15;
const DEFAULT_BOND_TUBULAR_SEGMENTS = 8;
const DEFAULT_BOND_MATERIAL: ExportMaterial = {
    baseColor: [0.78, 0.78, 0.82, 1],
    metallic: 0.1,
    roughness: 0.4,
    emissive: [0, 0, 0]
};

const resolveLineOptions = (options: LineExportOptions): ResolvedLineOptions => ({
    ...DEFAULT_LINE_OPTIONS,
    ...options,
    material: {
        ...DEFAULT_LINE_OPTIONS.material,
        ...options.material
    }
} as ResolvedLineOptions);

const createLineGeometry = (
    points: Vec3[],
    lineWidth: number,
    tubularSegments: number,
    vertexOffset: number
): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } => {
    if (points.length < 2) {
        return {
            positions: new Float32Array(0),
            normals: new Float32Array(0),
            indices: new Uint32Array(0)
        };
    }

    const maxEdges = points.length - 1;
    const positions = new Float32Array(maxEdges * (tubularSegments + 1) * 2 * 3);
    const normals = new Float32Array(positions.length);
    const indices = new Uint32Array(maxEdges * tubularSegments * 6);

    let positionCursor = 0;
    let indexCursor = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
        const pointOne = points[index];
        const pointTwo = points[index + 1];
        const direction = [
            pointTwo[0] - pointOne[0],
            pointTwo[1] - pointOne[1],
            pointTwo[2] - pointOne[2]
        ];
        const length = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
        if (length < 1e-10) {
            continue;
        }

        direction[0] /= length;
        direction[1] /= length;
        direction[2] /= length;

        let up = Math.abs(direction[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
        const right = [
            direction[1] * up[2] - direction[2] * up[1],
            direction[2] * up[0] - direction[0] * up[2],
            direction[0] * up[1] - direction[1] * up[0]
        ];
        const rightLength = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2);
        right[0] /= rightLength;
        right[1] /= rightLength;
        right[2] /= rightLength;

        up = [
            direction[1] * right[2] - direction[2] * right[1],
            direction[2] * right[0] - direction[0] * right[2],
            direction[0] * right[1] - direction[1] * right[0]
        ];

        const baseVertexIndex = vertexOffset + positionCursor / 3;
        const radius = lineWidth * 0.5;

        for (let segmentIndex = 0; segmentIndex <= tubularSegments; segmentIndex += 1) {
            const angle = (segmentIndex / tubularSegments) * Math.PI * 2;
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            const offset = [
                (right[0] * cosine + up[0] * sine) * radius,
                (right[1] * cosine + up[1] * sine) * radius,
                (right[2] * cosine + up[2] * sine) * radius
            ];

            positions[positionCursor] = pointOne[0] + offset[0];
            positions[positionCursor + 1] = pointOne[1] + offset[1];
            positions[positionCursor + 2] = pointOne[2] + offset[2];
            positions[positionCursor + 3] = pointTwo[0] + offset[0];
            positions[positionCursor + 4] = pointTwo[1] + offset[1];
            positions[positionCursor + 5] = pointTwo[2] + offset[2];

            const normalLength = Math.sqrt(offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2);
            if (normalLength > 1e-6) {
                const nx = offset[0] / normalLength;
                const ny = offset[1] / normalLength;
                const nz = offset[2] / normalLength;
                normals[positionCursor] = nx;
                normals[positionCursor + 1] = ny;
                normals[positionCursor + 2] = nz;
                normals[positionCursor + 3] = nx;
                normals[positionCursor + 4] = ny;
                normals[positionCursor + 5] = nz;
            } else {
                normals[positionCursor + 1] = 1;
                normals[positionCursor + 4] = 1;
            }

            positionCursor += 6;
        }

        for (let segmentIndex = 0; segmentIndex < tubularSegments; segmentIndex += 1) {
            const v1 = baseVertexIndex + segmentIndex * 2;
            const v2 = baseVertexIndex + segmentIndex * 2 + 1;
            const v3 = baseVertexIndex + (segmentIndex + 1) * 2;
            const v4 = baseVertexIndex + (segmentIndex + 1) * 2 + 1;
            indices[indexCursor] = v1;
            indices[indexCursor + 1] = v2;
            indices[indexCursor + 2] = v3;
            indices[indexCursor + 3] = v3;
            indices[indexCursor + 4] = v2;
            indices[indexCursor + 5] = v4;
            indexCursor += 6;
        }
    }

    return {
        positions: positionCursor < positions.length ? positions.subarray(0, positionCursor) : positions,
        normals: positionCursor < normals.length ? normals.subarray(0, positionCursor) : normals,
        indices: indexCursor < indices.length ? indices.subarray(0, indexCursor) : indices
    };
};

const estimateLineGeometry = (
    lines: LineEntity[],
    tubularSegments: number,
    minSegmentPoints: number
): { vertexCount: number; indexCount: number } => {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const line of lines) {
        if (line.points.length < minSegmentPoints) {
            continue;
        }

        const edges = line.points.length - 1;
        totalVertices += edges * (tubularSegments + 1) * 2;
        totalIndices += edges * tubularSegments * 6;

        if (totalVertices > MAX_LINE_VERTICES) {
            return {
                vertexCount: MAX_LINE_VERTICES,
                indexCount: totalIndices
            };
        }
    }

    return {
        vertexCount: totalVertices,
        indexCount: totalIndices
    };
};

const resolveEntityCategory = (entity: LineEntity, property: string): string => {
    const value = entity[property];
    return value === null || value === undefined ? '' : String(value);
};

const buildColorResolver = (
    lines: LineEntity[],
    options: ResolvedLineOptions
): ((entity: LineEntity) => Rgba) | undefined => {
    const property = options.colorBy;
    if (!property) {
        return undefined;
    }

    const colors = resolveCategoryColors(lines.map((line) => resolveEntityCategory(line, property)), options.propertyColors);
    return (entity) => colors.get(resolveEntityCategory(entity, property)) ?? FALLBACK_LINE_COLOR;
};

export interface LineGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    vertexCount: number;
    bounds: { min: Vec3; max: Vec3 };
}

export const processLines = (lines: LineEntity[], options: ResolvedLineOptions): LineGeometry | null => {
    const estimate = estimateLineGeometry(lines, options.tubularSegments, options.minSegmentPoints);
    if (estimate.vertexCount === 0) {
        return null;
    }

    const getEntityColor = buildColorResolver(lines, options);
    const positions = new Float32Array(estimate.vertexCount * 3);
    const normals = new Float32Array(estimate.vertexCount * 3);
    const indices = new Uint32Array(estimate.indexCount);
    const colors = getEntityColor ? new Float32Array(estimate.vertexCount * 4) : undefined;

    let vertexOffset = 0;
    let indexOffset = 0;

    for (const line of lines) {
        if (line.points.length < options.minSegmentPoints) {
            continue;
        }

        const geometry = createLineGeometry(line.points, options.lineWidth, options.tubularSegments, vertexOffset);
        if (geometry.positions.length === 0) {
            continue;
        }

        const entityVertexCount = geometry.positions.length / 3;
        if (vertexOffset + entityVertexCount > MAX_LINE_VERTICES) {
            break;
        }

        positions.set(geometry.positions, vertexOffset * 3);
        normals.set(geometry.normals, vertexOffset * 3);
        indices.set(geometry.indices, indexOffset);
        indexOffset += geometry.indices.length;

        if (getEntityColor && colors) {
            const color = getEntityColor(line);
            for (let vertex = 0; vertex < entityVertexCount; vertex += 1) {
                colors.set(color, (vertexOffset + vertex) * 4);
            }
        }

        vertexOffset += entityVertexCount;
    }

    if (vertexOffset === 0) {
        return null;
    }

    const finalPositions = positions.subarray(0, vertexOffset * 3);
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < finalPositions.length; index += 3) {
        min[0] = Math.min(min[0], finalPositions[index]);
        min[1] = Math.min(min[1], finalPositions[index + 1]);
        min[2] = Math.min(min[2], finalPositions[index + 2]);
        max[0] = Math.max(max[0], finalPositions[index]);
        max[1] = Math.max(max[1], finalPositions[index + 1]);
        max[2] = Math.max(max[2], finalPositions[index + 2]);
    }

    return {
        positions: finalPositions,
        normals: normals.subarray(0, vertexOffset * 3),
        indices: indices.subarray(0, indexOffset),
        colors: colors?.subarray(0, vertexOffset * 4),
        vertexCount: vertexOffset,
        bounds: { min, max }
    };
};

const tubeMaterial = (material: ExportMaterial): MeshMaterial => ({ ...material, doubleSided: true });

const exportTubes = (lines: LineEntity[], options: ResolvedLineOptions): Blob => {
    const geometry = processLines(lines, options);
    if (!geometry) {
        return buildEmptyMeshGlb(tubeMaterial(options.material));
    }

    return buildMeshGlb({
        positions: geometry.positions,
        normals: geometry.normals,
        indices: geometry.vertexCount <= 65535 ? new Uint16Array(geometry.indices) : geometry.indices,
        colors: geometry.colors,
        bounds: geometry.bounds
    }, tubeMaterial(options.material));
};

export const exportLines = (lines: LineEntity[], options: LineExportOptions): Blob =>
    exportTubes(lines, resolveLineOptions(options));

export const exportBonds = (bonds: LineEntity[], options: BondExportOptions): Blob => exportTubes(bonds, resolveLineOptions({
    ...options,
    lineWidth: (options.radius ?? DEFAULT_BOND_RADIUS) * 2,
    tubularSegments: options.tubularSegments ?? DEFAULT_BOND_TUBULAR_SEGMENTS,
    material: {
        ...DEFAULT_BOND_MATERIAL,
        ...options.material
    }
}));
