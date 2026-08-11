import { resolveCategoryColors } from '@modules/plugin/services/exports/category-colors';
import type { LineEntityRange, LineEntityRangesSidecar } from '@modules/plugin/services/exports/line-scene-source';
import { yieldToEventLoop } from '@modules/plugin/services/exports/export-node-processor-shared';
import {
    MAX_LINE_VERTICES,
    createLineGeometry,
    estimateLineGeometry
} from '@modules/plugin/services/exports/line-tube-geometry';
import type {
    LineEntity,
    LineExportData,
    LineExportOptions
} from '@modules/plugin/services/exports/export-node-processor-types';
import spatialAssembler from '@voltstack/spatial-assembler';

/** Assembles tube geometry for line-like entities and encodes it as a GLB plus range sidecar. */

interface ProcessedLineGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    vertexCount: number;
    entityRanges: LineEntityRange[];
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

interface LineGeometryHooks {
    includeEntity?: (entity: LineEntity) => boolean;
    getEntityColor?: (entity: LineEntity) => [number, number, number, number];
}

const resolveEntityCategory = (entity: LineEntity, property: string): string => {
    const value = entity[property];
    return value === null || value === undefined ? '' : String(value);
};

const buildDefaultColorResolver = (
    lines: LineEntity[],
    options: Required<LineExportOptions>
): ((entity: LineEntity) => [number, number, number, number]) | undefined => {
    const property = options.colorBy;
    if (!property) {
        return undefined;
    }

    const categories = lines.map((line) => resolveEntityCategory(line, property));
    const colors = resolveCategoryColors(categories, options.propertyColors);
    return (entity) => colors.get(resolveEntityCategory(entity, property)) ?? [0.9, 0.2, 0.2, 1];
};

export const processLines = async (
    data: LineExportData,
    options: Required<LineExportOptions>,
    hooks?: LineGeometryHooks
): Promise<ProcessedLineGeometry | null> => {
    const lines = data.lines;
    const estimate = estimateLineGeometry(lines, options.tubularSegments, options.minSegmentPoints);
    if (estimate.vertexCount === 0) {
        return null;
    }

    const getEntityColor = hooks?.getEntityColor ?? buildDefaultColorResolver(lines, options);
    const positions = new Float32Array(estimate.vertexCount * 3);
    const normals = new Float32Array(estimate.vertexCount * 3);
    const indices = new Uint32Array(estimate.indexCount);
    const colors = getEntityColor ? new Float32Array(estimate.vertexCount * 4) : undefined;
    const entityRanges: LineEntityRange[] = [];

    let vertexOffset = 0;
    let indexOffset = 0;
    let sinceLastYield = 0;

    for (const line of lines) {
        if (line.points.length < options.minSegmentPoints) {
            continue;
        }

        if (hooks?.includeEntity && !hooks.includeEntity(line)) {
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

        const positionBase = vertexOffset * 3;

        positions.set(geometry.positions, positionBase);
        normals.set(geometry.normals, positionBase);
        indices.set(geometry.indices, indexOffset);

        entityRanges.push({
            id: line.id,
            triangleStart: indexOffset / 3,
            triangleCount: geometry.indices.length / 3
        });
        indexOffset += geometry.indices.length;

        if (getEntityColor && colors) {
            const color = getEntityColor(line);
            const colorBase = vertexOffset * 4;
            const colorTotal = entityVertexCount * 4;
            colors.set(color, colorBase);
            let filled = 4;
            while (filled < colorTotal) {
                const chunk = Math.min(filled, colorTotal - filled);
                colors.copyWithin(colorBase + filled, colorBase, colorBase + chunk);
                filled += chunk;
            }
        }

        vertexOffset += entityVertexCount;
        sinceLastYield += 1;
        if (sinceLastYield >= 500) {
            sinceLastYield = 0;
            await yieldToEventLoop();
        }
    }

    if (vertexOffset === 0) {
        return null;
    }

    const finalPositions = vertexOffset * 3 < positions.length ? positions.subarray(0, vertexOffset * 3) : positions;
    const finalNormals = vertexOffset * 3 < normals.length ? normals.subarray(0, vertexOffset * 3) : normals;
    const finalIndices = indexOffset < indices.length ? indices.subarray(0, indexOffset) : indices;
    const finalColors = colors
        ? (vertexOffset * 4 < colors.length ? colors.subarray(0, vertexOffset * 4) : colors)
        : undefined;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

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
        normals: finalNormals,
        indices: finalIndices,
        colors: finalColors,
        vertexCount: vertexOffset,
        entityRanges,
        bounds: {
            min,
            max
        }
    };
};

const DEFAULT_LINE_OPTIONS: Required<LineExportOptions> = {
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

const EMPTY_LINE_GEOMETRY: ProcessedLineGeometry = {
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    vertexCount: 0,
    entityRanges: [],
    bounds: {
        min: [0, 0, 0],
        max: [0, 0, 0]
    }
};

export const resolveLineOptions = (options: LineExportOptions): Required<LineExportOptions> => ({
    ...DEFAULT_LINE_OPTIONS,
    ...options,
    material: {
        ...DEFAULT_LINE_OPTIONS.material,
        ...options.material
    }
});

export const buildLineGlb = (
    geometry: ProcessedLineGeometry,
    material: Required<LineExportOptions>['material']
): Buffer => {
    const indexBuffer = geometry.vertexCount > 0 && geometry.vertexCount <= 65535
        ? new Uint16Array(geometry.indices)
        : geometry.indices;
    return spatialAssembler.generateMeshGLB(
        geometry.positions,
        geometry.normals,
        indexBuffer,
        Boolean(geometry.colors),
        geometry.colors || undefined,
        {
            minX: geometry.bounds.min[0],
            minY: geometry.bounds.min[1],
            minZ: geometry.bounds.min[2],
            maxX: geometry.bounds.max[0],
            maxY: geometry.bounds.max[1],
            maxZ: geometry.bounds.max[2]
        },
        {
            baseColor: material.baseColor,
            metallic: material.metallic,
            roughness: material.roughness,
            emissive: material.emissive,
            doubleSided: true
        }
    );
};

export const generateEmptyLineGLB = (material: Required<LineExportOptions>['material']): Buffer =>
    buildLineGlb(EMPTY_LINE_GEOMETRY, material);

export const encodeLineRangesSidecar = (entityRanges: LineEntityRange[]): Buffer => {
    const sidecar: LineEntityRangesSidecar = {
        version: 1,
        entities: entityRanges
    };
    return Buffer.from(JSON.stringify(sidecar), 'utf8');
};
