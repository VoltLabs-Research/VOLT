import path from 'node:path';

import type { NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import { ObjectBucketName } from '@/core/storage/contracts/http.objectStore';
import { isRecord } from '@/support/type-guards/isRecord';
import { buildArtifactReportInput, yieldToEventLoop } from '@/modules/plugin/application/exports/ExportNodeProcessor.shared';
import type { DislocationExportOptions, ExportExecutionInput } from '@/modules/plugin/application/exports/ExportNodeProcessor.types';

const readFiniteCoordinate = (value: unknown): number | null => {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : null;
};

interface ProcessedDislocationGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    vertexCount: number;
    triangleCount: number;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

const MAX_DISLOCATION_VERTICES = 5_000_000;
const DISLOCATION_TYPE_COLORS: Record<string, [number, number, number, number]> = {
    Other: [0.95, 0.1, 0.1, 1.0],
    '1/2<111>': [0.1, 0.9, 0.1, 1.0],
    '<100>': [1, 0.45, 0.74, 1.0],
    '<110>': [0.1, 0.7, 0.95, 1.0],
    '<111>': [0.95, 0.9, 0.1, 1.0],
    '1/6<112>': [0.9, 0.5, 0.1, 1.0]
};

const calculateDislocationType = (
    segment: Record<string, unknown>,
    tolerance: number = 1e-6
): string => {
    const burgers = isRecord(segment.burgers) ? segment.burgers : null;
    if (!burgers || !Array.isArray(burgers.vector) || burgers.vector.length !== 3) {
        return 'Other';
    }

    const [bx, by, bz] = (burgers.vector as number[]).map(Math.abs);
    const halfComponents = [bx, by, bz].filter((component) => component > tolerance);

    if (halfComponents.length === 3) {
        const maxComponent = Math.max(...halfComponents);
        const minComponent = Math.min(...halfComponents);
        if ((maxComponent - minComponent) / maxComponent < tolerance && maxComponent > 0.4 && maxComponent < 0.6) {
            return '1/2<111>';
        }
    }

    if ([bx, by, bz].filter((component) => component > tolerance).length === 1) {
        return '<100>';
    }

    {
        const sorted = [bx, by, bz].sort((left, right) => right - left);
        if (Math.abs(sorted[0] - sorted[1]) < tolerance && sorted[2] < tolerance) {
            return '<110>';
        }
    }

    {
        const maxComponent = Math.max(bx, by, bz);
        if (maxComponent >= tolerance) {
            const ratios = [
                Math.abs(bx / maxComponent - 1),
                Math.abs(by / maxComponent - 1),
                Math.abs(bz / maxComponent - 1)
            ];
            if (ratios.every((ratio) => ratio < tolerance) && maxComponent >= 0.8) {
                return '<111>';
            }
        }
    }

    {
        const sorted = [bx, by, bz].sort((left, right) => right - left);
        if (sorted[0] >= tolerance && sorted[1] >= tolerance && sorted[2] >= tolerance) {
            const ratioOne = Math.abs(sorted[0] / sorted[1] - 2);
            const ratioTwo = Math.abs(sorted[1] / sorted[2] - 1);
            if (ratioOne < tolerance && ratioTwo < tolerance && sorted[0] < 0.4) {
                return '1/6<112>';
            }
        }
    }

    return 'Other';
};

const createLineGeometry = (
    points: [number, number, number][],
    lineWidth: number,
    tubularSegments: number = 8
): { positions: number[]; normals: number[]; indices: number[] } => {
    if (points.length < 2) {
        return { positions: [], normals: [], indices: [] };
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

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

        const baseVertexIndex = positions.length / 3;
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

            positions.push(pointOne[0] + offset[0], pointOne[1] + offset[1], pointOne[2] + offset[2]);
            positions.push(pointTwo[0] + offset[0], pointTwo[1] + offset[1], pointTwo[2] + offset[2]);

            const normalLength = Math.sqrt(offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2);
            if (normalLength > 1e-6) {
                normals.push(offset[0] / normalLength, offset[1] / normalLength, offset[2] / normalLength);
                normals.push(offset[0] / normalLength, offset[1] / normalLength, offset[2] / normalLength);
                continue;
            }

            normals.push(0, 1, 0, 0, 1, 0);
        }

        for (let segmentIndex = 0; segmentIndex < tubularSegments; segmentIndex += 1) {
            const v1 = baseVertexIndex + segmentIndex * 2;
            const v2 = baseVertexIndex + segmentIndex * 2 + 1;
            const v3 = baseVertexIndex + (segmentIndex + 1) * 2;
            const v4 = baseVertexIndex + (segmentIndex + 1) * 2 + 1;
            indices.push(v1, v2, v3, v3, v2, v4);
        }
    }

    return { positions, normals, indices };
};

const estimateSegmentGeometry = (
    segments: unknown[],
    tubularSegments: number,
    minSegmentPoints: number
): { vertexCount: number; indexCount: number } => {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const segment of segments) {
        if (!isRecord(segment)) {
            continue;
        }

        const points = Array.isArray(segment.points) ? segment.points : [];
        const validPoints = points.filter(
            (point: unknown): point is number[] => Array.isArray(point) && point.length >= 3
        ).length;
        if (validPoints < minSegmentPoints) {
            continue;
        }

        const edges = validPoints - 1;
        totalVertices += edges * (tubularSegments + 1) * 2;
        totalIndices += edges * tubularSegments * 6;

        if (totalVertices > MAX_DISLOCATION_VERTICES) {
            return { vertexCount: MAX_DISLOCATION_VERTICES, indexCount: totalIndices };
        }
    }

    return { vertexCount: totalVertices, indexCount: totalIndices };
};

const processDislocations = async (
    data: Record<string, unknown>,
    options: Required<DislocationExportOptions>
): Promise<ProcessedDislocationGeometry | null> => {
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const typeColors = { ...DISLOCATION_TYPE_COLORS, ...options.typeColors };
    const estimate = estimateSegmentGeometry(segments, options.tubularSegments, options.minSegmentPoints);
    if (estimate.vertexCount === 0) {
        return null;
    }

    const positions = new Float32Array(estimate.vertexCount * 3);
    const normals = new Float32Array(estimate.vertexCount * 3);
    const indices = new Uint32Array(estimate.indexCount);
    const colors = options.colorByType ? new Float32Array(estimate.vertexCount * 4) : undefined;

    let vertexOffset = 0;
    let indexOffset = 0;
    let sinceLastYield = 0;

    for (const segment of segments) {
        if (!isRecord(segment)) {
            continue;
        }

        const points = Array.isArray(segment.points) ? segment.points : [];
        const normalizedPoints: [number, number, number][] = points
            .map((point): [number, number, number] | null => {
                if (!Array.isArray(point) || point.length < 3) {
                    return null;
                }

                const x = readFiniteCoordinate(point[0]);
                const y = readFiniteCoordinate(point[1]);
                const z = readFiniteCoordinate(point[2]);
                if (x === null || y === null || z === null) {
                    return null;
                }

                return [x, y, z];
            })
            .filter((point): point is [number, number, number] => point !== null);
        if (normalizedPoints.length < options.minSegmentPoints) {
            continue;
        }

        const geometry = createLineGeometry(normalizedPoints, options.lineWidth, options.tubularSegments);
        if (geometry.positions.length === 0) {
            continue;
        }

        const segmentVertexCount = geometry.positions.length / 3;
        if (vertexOffset + segmentVertexCount > MAX_DISLOCATION_VERTICES) {
            break;
        }

        const type = calculateDislocationType(segment);
        const positionBase = vertexOffset * 3;

        for (let index = 0; index < geometry.positions.length; index += 1) {
            positions[positionBase + index] = geometry.positions[index];
        }

        for (let index = 0; index < geometry.normals.length; index += 1) {
            normals[positionBase + index] = geometry.normals[index];
        }

        for (let index = 0; index < geometry.indices.length; index += 1) {
            indices[indexOffset + index] = geometry.indices[index] + vertexOffset;
        }
        indexOffset += geometry.indices.length;

        if (options.colorByType && colors) {
            const color = typeColors[type] || typeColors.Other;
            const colorBase = vertexOffset * 4;
            for (let index = 0; index < segmentVertexCount; index += 1) {
                const colorIndex = colorBase + index * 4;
                colors[colorIndex] = color[0];
                colors[colorIndex + 1] = color[1];
                colors[colorIndex + 2] = color[2];
                colors[colorIndex + 3] = color[3];
            }
        }

        vertexOffset += segmentVertexCount;
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
        bounds: { min, max }
    };
};

const readPositiveFiniteNumber = (value: unknown, fallback: number): number => {
    const parsedValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0
        ? parsedValue
        : fallback;
};

const readMinimumInteger = (value: unknown, fallback: number, minimum: number): number => {
    const parsedValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue < minimum) {
        return fallback;
    }

    return parsedValue;
};

export const exportDislocationArtifact = async (
    nativeModuleLoader: NativeModuleLoader,
    input: ExportExecutionInput,
    exportData: Record<string, unknown>,
    objectPath: string,
    ownerClusterId: string,
    options: DislocationExportOptions
): Promise<boolean> => {
    const resolvedOptions: Required<DislocationExportOptions> = {
        lineWidth: readPositiveFiniteNumber(options.lineWidth, 0.08),
        tubularSegments: readMinimumInteger(options.tubularSegments, 12, 3),
        minSegmentPoints: readMinimumInteger(options.minSegmentPoints, 2, 2),
        material: {
            baseColor: options.material?.baseColor ?? [1, 1, 1, 1],
            metallic: options.material?.metallic ?? 0.1,
            roughness: options.material?.roughness ?? 0.3,
            emissive: options.material?.emissive ?? [0, 0, 0]
        },
        colorByType: options.colorByType ?? true,
        typeColors: options.typeColors ?? {}
    };
    const geometry = await processDislocations(exportData, resolvedOptions);
    if (!geometry) {
        return false;
    }

    const indexBuffer = geometry.vertexCount > 0 && geometry.vertexCount <= 65535
        ? new Uint16Array(geometry.indices)
        : geometry.indices;
    const buffer = nativeModuleLoader.getExporterModule().generateMeshGLB(
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
            baseColor: resolvedOptions.material.baseColor,
            metallic: resolvedOptions.material.metallic,
            roughness: resolvedOptions.material.roughness,
            emissive: resolvedOptions.material.emissive,
            doubleSided: true
        }
    );

    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Models,
        objectKey: objectPath,
        buffer,
        contentType: 'model/gltf-binary',
        fileName: path.basename(objectPath),
        reportArtifact: buildArtifactReportInput(
            input,
            'DislocationExporter',
            input.exposure.export!,
            objectPath,
            ObjectBucketName.Models
        )
    });

    return true;
};
