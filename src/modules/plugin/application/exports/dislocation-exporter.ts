import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import {
    buildDislocationSceneSourceKey,
    encodeDislocationSceneSource,
    DISLOCATION_SCENE_SOURCE_VERSION
} from '@/modules/plugin/application/exports/dislocation-scene-source';
import { stageExportBufferUpload, yieldToEventLoop } from '@/modules/plugin/application/exports/export-node-processor-shared';
import type {
    DislocationExportData,
    DislocationExportOptions,
    DislocationSegment,
    ExportExecutionInput
} from '@/modules/plugin/application/exports/export-node-processor-types';
import spatialAssembler from '@voltstack/spatial-assembler';
import path from 'node:path';

export interface ProcessedDislocationGeometry {
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

// Styled re-exports (dislocation-model command) plug into the shared geometry
// builder through these hooks instead of duplicating the tube triangulation.
export interface DislocationGeometryHooks {
    includeSegment?: (segment: DislocationSegment, family: string) => boolean;
    getSegmentColor?: (segment: DislocationSegment, family: string) => [number, number, number, number];
}

const MAX_DISLOCATION_VERTICES = 5_000_000;
// OVITO-parity defaults per Burgers family, overridable via options.typeColors.
export const DISLOCATION_TYPE_COLORS: Record<string, [number, number, number, number]> = {
    Other: [0.9, 0.2, 0.2, 1.0],
    '1/2<110>': [0.2, 0.2, 1.0, 1.0],
    '1/6<112>': [0.0, 1.0, 0.0, 1.0],
    '1/6<110>': [1.0, 0.0, 1.0, 1.0],
    '1/3<100>': [1.0, 1.0, 0.0, 1.0],
    '1/3<111>': [0.0, 1.0, 1.0, 1.0],
    '1/2<111>': [0.2, 0.95, 0.2, 1.0],
    '<100>': [1.0, 0.3, 0.8, 1.0],
    '<110>': [0.2, 0.5, 1.0, 1.0],
    '<111>': [1.0, 0.8, 0.2, 1.0],
    '1/3<1-210>': [0.0, 1.0, 0.0, 1.0],
    '1/3<1-100>': [1.0, 0.0, 1.0, 1.0],
    '<0001>': [1.0, 0.3, 0.8, 1.0],
    '1/2<0001>': [1.0, 1.0, 0.0, 1.0],
    '1/3<1-213>': [0.0, 1.0, 1.0, 1.0]
};

// Fallback for plugin binaries that predate the in-plugin burgers_family
// classification. Burgers vectors come in the cluster lattice frame (unit
// cubic lattice constant); matching on sorted absolute components is
// permutation/sign invariant. FCC, BCC and SC prototypes do not collide, so a
// single table is safe without knowing the crystal structure. Hexagonal
// vectors never match cubic prototypes and stay 'Other' here — binaries new
// enough to analyze HCP reliably already emit burgers_family themselves.
const FALLBACK_BURGERS_FAMILIES: Array<{ components: [number, number, number]; family: string }> = [
    { components: [0.5, 0.5, 0], family: '1/2<110>' },
    { components: [1 / 3, 1 / 6, 1 / 6], family: '1/6<112>' },
    { components: [1 / 6, 1 / 6, 0], family: '1/6<110>' },
    { components: [1 / 3, 0, 0], family: '1/3<100>' },
    { components: [1 / 3, 1 / 3, 1 / 3], family: '1/3<111>' },
    { components: [0.5, 0.5, 0.5], family: '1/2<111>' },
    { components: [1, 0, 0], family: '<100>' },
    { components: [1, 1, 0], family: '<110>' },
    { components: [1, 1, 1], family: '<111>' }
];

const FALLBACK_FAMILY_TOLERANCE = 0.01;

const classifyBurgersVectorFallback = (segment: DislocationSegment): string => {
    const vector = segment.burgers_vector_local ?? segment.burgers_vector;
    if (!vector) {
        return 'Other';
    }

    const sorted = vector.map(Math.abs).sort((left, right) => right - left);
    for (const candidate of FALLBACK_BURGERS_FAMILIES) {
        if (
            Math.abs(sorted[0] - candidate.components[0]) < FALLBACK_FAMILY_TOLERANCE
            && Math.abs(sorted[1] - candidate.components[1]) < FALLBACK_FAMILY_TOLERANCE
            && Math.abs(sorted[2] - candidate.components[2]) < FALLBACK_FAMILY_TOLERANCE
        ) {
            return candidate.family;
        }
    }

    return 'Other';
};

export const resolveDislocationFamily = (segment: DislocationSegment): string => (
    segment.burgers_family ?? classifyBurgersVectorFallback(segment)
);

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
    segments: DislocationSegment[],
    tubularSegments: number,
    minSegmentPoints: number
): { vertexCount: number; indexCount: number } => {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const segment of segments) {
        if (segment.points.length < minSegmentPoints) {
            continue;
        }

        const edges = segment.points.length - 1;
        totalVertices += edges * (tubularSegments + 1) * 2;
        totalIndices += edges * tubularSegments * 6;

        if (totalVertices > MAX_DISLOCATION_VERTICES) {
            return { vertexCount: MAX_DISLOCATION_VERTICES, indexCount: totalIndices };
        }
    }

    return { vertexCount: totalVertices, indexCount: totalIndices };
};

export const processDislocations = async (
    data: DislocationExportData,
    options: Required<DislocationExportOptions>,
    hooks?: DislocationGeometryHooks
): Promise<ProcessedDislocationGeometry | null> => {
    const segments = data.segments;
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
        if (segment.points.length < options.minSegmentPoints) {
            continue;
        }

        const type = resolveDislocationFamily(segment);
        if (hooks?.includeSegment && !hooks.includeSegment(segment, type)) {
            continue;
        }

        const geometry = createLineGeometry(segment.points, options.lineWidth, options.tubularSegments);
        if (geometry.positions.length === 0) {
            continue;
        }

        const segmentVertexCount = geometry.positions.length / 3;
        if (vertexOffset + segmentVertexCount > MAX_DISLOCATION_VERTICES) {
            break;
        }

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
            const color = hooks?.getSegmentColor
                ? hooks.getSegmentColor(segment, type)
                : (typeColors[type] || typeColors.Other);
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

export const DEFAULT_DISLOCATION_OPTIONS: Required<DislocationExportOptions> = {
    lineWidth: 0.08,
    tubularSegments: 12,
    minSegmentPoints: 2,
    material: {
        baseColor: [1, 1, 1, 1],
        metallic: 0.1,
        roughness: 0.3,
        emissive: [0, 0, 0]
    },
    colorByType: true,
    typeColors: {}
};

export const generateEmptyDislocationGLB = (material: Required<DislocationExportOptions>['material']): Buffer => (
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

export const buildDislocationGlb = (
    geometry: ProcessedDislocationGeometry,
    material: Required<DislocationExportOptions>['material']
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

const stageSceneSourceUpload = async (
    input: ExportExecutionInput,
    exportData: DislocationExportData,
    options: DislocationExportOptions,
    ownerClusterId: string
): Promise<void> => {
    const objectKey = buildDislocationSceneSourceKey(
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
        buffer: encodeDislocationSceneSource({
            version: DISLOCATION_SCENE_SOURCE_VERSION,
            exporter: 'DislocationExporter',
            options,
            data: exportData
        }),
        contentType: 'application/json',
        fileName: path.basename(objectKey)
    });
};

export const exportDislocationArtifact = async (
    input: ExportExecutionInput,
    exportData: DislocationExportData,
    objectPath: string,
    ownerClusterId: string,
    options: DislocationExportOptions
): Promise<boolean> => {
    const resolvedOptions: Required<DislocationExportOptions> = {
        ...DEFAULT_DISLOCATION_OPTIONS,
        ...options,
        material: { ...DEFAULT_DISLOCATION_OPTIONS.material, ...options.material }
    };

    await stageSceneSourceUpload(input, exportData, options, ownerClusterId);

    const geometry = await processDislocations(exportData, resolvedOptions);
    if (!geometry) {
        await stageExportBufferUpload(input, {
            exporter: 'DislocationExporter',
            bucket: ObjectBucketName.Models,
            buffer: generateEmptyDislocationGLB(resolvedOptions.material),
            contentType: 'model/gltf-binary',
            objectPath,
            ownerClusterId
        });
        return true;
    }

    const buffer = buildDislocationGlb(geometry, resolvedOptions.material);

    await stageExportBufferUpload(input, {
        exporter: 'DislocationExporter',
        bucket: ObjectBucketName.Models,
        buffer,
        contentType: 'model/gltf-binary',
        objectPath,
        ownerClusterId
    });

    return true;
};
