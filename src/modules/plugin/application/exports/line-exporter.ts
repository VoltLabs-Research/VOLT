import fs from 'node:fs/promises';
import path from 'node:path';

import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { resolveCategoryColors } from '@/modules/plugin/application/exports/category-colors';
import {
    buildLineRangesSidecarKey,
    buildLineSceneSourceKey,
    type LineEntityRange,
    type LineEntityRangesSidecar
} from '@/modules/plugin/application/exports/line-scene-source';
import { stageExportBufferUpload, yieldToEventLoop } from '@/modules/plugin/application/exports/export-node-processor-shared';
import type {
    ExportExecutionInput,
    LineEntity,
    LineExportData,
    LineExportOptions
} from '@/modules/plugin/application/exports/export-node-processor-types';
import spatialAssembler from '@voltstack/spatial-assembler';

export interface ProcessedLineGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    vertexCount: number;
    triangleCount: number;
    entityRanges: LineEntityRange[];
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

// Styled re-exports (line-model command) plug into the shared geometry builder
// through these hooks instead of duplicating the tube triangulation.
export interface LineGeometryHooks {
    includeEntity?: (entity: LineEntity) => boolean;
    getEntityColor?: (entity: LineEntity) => [number, number, number, number];
}

const MAX_LINE_VERTICES = 5_000_000;

export const resolveEntityCategory = (entity: LineEntity, property: string): string => {
    const value = entity[property];
    return value === null || value === undefined ? '' : String(value);
};

// Writes straight into per-line typed arrays (allocated once at the edge
// upper bound, never grown) so processLines can bulk-copy them with .set().
// vertexOffset is baked into the emitted indices, making them global and
// likewise copyable without a per-element rewrite.
const createLineGeometry = (
    points: [number, number, number][],
    lineWidth: number,
    tubularSegments: number,
    vertexOffset: number
): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } => {
    if (points.length < 2) {
        return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0) };
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
            return { vertexCount: MAX_LINE_VERTICES, indexCount: totalIndices };
        }
    }

    return { vertexCount: totalVertices, indexCount: totalIndices };
};

// Default categorical colors: explicit plugin colors first, then a
// deterministic palette over the remaining sorted category values.
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

        // Indices already carry vertexOffset from createLineGeometry, so all
        // three buffers copy with the native bulk path instead of scalar loops.
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
            colors[colorBase] = color[0];
            colors[colorBase + 1] = color[1];
            colors[colorBase + 2] = color[2];
            colors[colorBase + 3] = color[3];
            // Replicate the RGBA quad across the entity's vertices by doubling
            // copyWithin runs (native memmove) rather than a scalar per-vertex fill.
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
        triangleCount: finalIndices.length / 3,
        entityRanges,
        bounds: { min, max }
    };
};

export const DEFAULT_LINE_OPTIONS: Required<LineExportOptions> = {
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

export const resolveLineOptions = (options: LineExportOptions): Required<LineExportOptions> => ({
    ...DEFAULT_LINE_OPTIONS,
    ...options,
    material: { ...DEFAULT_LINE_OPTIONS.material, ...options.material }
});

export const generateEmptyLineGLB = (material: Required<LineExportOptions>['material']): Buffer => (
    spatialAssembler.generateMeshGLB(
        new Float32Array(0),
        new Float32Array(0),
        new Uint32Array(0),
        false,
        undefined,
        {
            minX: 0,
            minY: 0,
            minZ: 0,
            maxX: 0,
            maxY: 0,
            maxZ: 0
        },
        {
            baseColor: material.baseColor,
            metallic: material.metallic,
            roughness: material.roughness,
            emissive: material.emissive,
            doubleSided: true
        }
    )
);

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

export const encodeLineRangesSidecar = (entityRanges: LineEntityRange[]): Buffer => {
    const sidecar: LineEntityRangesSidecar = { version: 1, entities: entityRanges };
    return Buffer.from(JSON.stringify(sidecar), 'utf8');
};

// The exposure's line table doubles as the restyle source: persisting it next
// to the baked GLB means styled re-exports never re-run the analysis.
const stageSceneSourceUpload = async (
    input: ExportExecutionInput,
    ownerClusterId: string
): Promise<void> => {
    const objectKey = buildLineSceneSourceKey(
        input.executionData.trajectoryId,
        input.executionData.analysisId,
        input.timestep,
        input.exposure.nodeId
    );

    // No reportArtifact: the scene-source is an internal restyle input, not a
    // user-visible scene.
    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Models,
        objectKey,
        buffer: await fs.readFile(input.outputFilePath),
        contentType: 'application/vnd.apache.parquet',
        fileName: path.basename(objectKey)
    });
};

const stageRangesSidecarUpload = async (
    input: ExportExecutionInput,
    glbObjectPath: string,
    ownerClusterId: string,
    entityRanges: LineEntityRange[]
): Promise<void> => {
    const objectKey = buildLineRangesSidecarKey(glbObjectPath);
    // No reportArtifact: picking metadata rides next to the GLB.
    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Models,
        objectKey,
        buffer: encodeLineRangesSidecar(entityRanges),
        contentType: 'application/json',
        fileName: path.basename(objectKey)
    });
};

export const exportLineArtifact = async (
    input: ExportExecutionInput,
    exportData: LineExportData,
    objectPath: string,
    ownerClusterId: string,
    options: LineExportOptions
): Promise<boolean> => {
    const resolvedOptions = resolveLineOptions(options);

    await stageSceneSourceUpload(input, ownerClusterId);

    const geometry = await processLines(exportData, resolvedOptions);
    if (!geometry) {
        await stageExportBufferUpload(input, {
            exporter: 'LineExporter',
            bucket: ObjectBucketName.Models,
            buffer: generateEmptyLineGLB(resolvedOptions.material),
            contentType: 'model/gltf-binary',
            objectPath,
            ownerClusterId
        });
        return true;
    }

    const buffer = buildLineGlb(geometry, resolvedOptions.material);

    await stageExportBufferUpload(input, {
        exporter: 'LineExporter',
        bucket: ObjectBucketName.Models,
        buffer,
        contentType: 'model/gltf-binary',
        objectPath,
        ownerClusterId
    });
    await stageRangesSidecarUpload(input, objectPath, ownerClusterId, geometry.entityRanges);

    return true;
};
