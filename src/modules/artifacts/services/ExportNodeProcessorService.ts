import { ObjectBucketName, type AnalysisExposureDefinition, type AnalysisJobExecutionData } from '@/shared/contracts';
import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { NativeModuleLoader } from '@/modules/trajectory-native/services';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { BubbleDataPoint, ChartConfiguration, ChartDataset, ChartTypeRegistry, Point } from 'chart.js';
import type { DaemonArtifactReporterService } from '@/modules/cloud-control/services';
import { isRecord, toRecord } from '@/shared/utils';
import { uploadBufferToObjectStore } from '@/shared/storage/uploadBufferToObjectStore';
import { createScopedClusterObjectStore, type ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

type ExporterName = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter' | 'ChartExporter';

interface PrimitiveAtom {
    id: number;
    pos: [number, number, number];
};

interface AtomsGroupedByType {
    [typeName: string]: PrimitiveAtom[];
};

interface MeshFacet {
    vertices: [number, number, number];
};

interface MeshInput {
    vertices: Array<{
        index: number;
        position: [number, number, number];
    }>;
    facets: MeshFacet[];
};

interface ExportMaterial {
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
};

interface MeshExportOptions {
    generateNormals?: boolean;
    enableDoubleSided?: boolean;
    smoothIterations?: number;
    material?: ExportMaterial;
};

interface DislocationExportOptions {
    lineWidth?: number;
    tubularSegments?: number;
    minSegmentPoints?: number;
    material?: ExportMaterial;
    colorByType?: boolean;
    typeColors?: Record<string, [number, number, number, number]>;
};

interface ChartExportOptions {
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
};

interface ChartPoint {
    x: string | number;
    y: number;
};

export interface ExportExecutionInput {
    executionData: AnalysisJobExecutionData;
    exposure: AnalysisExposureDefinition;
    decodedPayload: Record<string, unknown>;
    timestep: number;
    storageClusterId: string;
};


const getNestedValue = (data: unknown, key: string): unknown => {
    if (!key) {
        return data;
    }

    return key.split('.').reduce<unknown>((current, segment) => {
        if (!isRecord(current)) {
            return undefined;
        }

        return current[segment];
    }, data);
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
    const numericValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toStringMap = (value: unknown): Record<string, unknown> => {
    return toRecord(value);
};

const buildObjectPath = (input: ExportExecutionInput, exporter: ExporterName, type: string, arrayIndex?: number): string => {
    const isChart = exporter === 'ChartExporter' || type === 'chart-png';
    const folder = isChart ? 'charts' : 'glb';
    const extension = isChart ? 'png' : type;
    const suffix = arrayIndex != null ? `_${arrayIndex}` : '';

    return `trajectory-${input.executionData.trajectoryId}/analysis-${input.executionData.analysisId}/${folder}/${input.timestep}/${input.exposure.nodeId}${suffix}.${extension}`;
};

const normalizeAtomsByType = (value: Record<string, unknown>): AtomsGroupedByType => {
    const result: AtomsGroupedByType = {};

    for (const [typeName, atoms] of Object.entries(value)) {
        if (!Array.isArray(atoms)) {
            continue;
        }

        const normalized = atoms
            .map((atom, index) => {
                if (!isRecord(atom) || !Array.isArray(atom.pos) || atom.pos.length < 3) {
                    return null;
                }

                return {
                    id: toFiniteNumber(atom.id, index),
                    pos: [
                        toFiniteNumber(atom.pos[0]),
                        toFiniteNumber(atom.pos[1]),
                        toFiniteNumber(atom.pos[2])
                    ] as [number, number, number]
                };
            })
            .filter((atom): atom is PrimitiveAtom => atom !== null);

        if (normalized.length > 0) {
            result[typeName] = normalized;
        }
    }

    return result;
};

const calculateDislocationType = (segment: Record<string, unknown>, tolerance: number = 1e-6): string => {
    const burgers = isRecord(segment.burgers) ? segment.burgers : null;
    if (!burgers || !Array.isArray(burgers.vector) || burgers.vector.length !== 3) {
        return 'Other';
    }

    const [bx, by, bz] = (burgers.vector as number[]).map(Math.abs);

    // 1/2<111>: all three components non-zero, nearly equal, magnitude ~0.5
    const halfComponents = [bx, by, bz].filter(x => x > tolerance);
    if (halfComponents.length === 3) {
        const maxC = Math.max(...halfComponents);
        const minC = Math.min(...halfComponents);
        if ((maxC - minC) / maxC < tolerance && maxC > 0.4 && maxC < 0.6) {
            return '1/2<111>';
        }
    }

    // <100>: exactly one component non-zero
    if ([bx, by, bz].filter(x => x > tolerance).length === 1) {
        return '<100>';
    }

    // <110>: two largest nearly equal, smallest ~0
    {
        const sorted = [bx, by, bz].sort((a, b) => b - a);
        if (Math.abs(sorted[0] - sorted[1]) < tolerance && sorted[2] < tolerance) {
            return '<110>';
        }
    }

    // <111>: all three nearly equal with magnitude >= 0.8
    {
        const maxC = Math.max(bx, by, bz);
        if (maxC >= tolerance) {
            const r1 = Math.abs(bx / maxC - 1);
            const r2 = Math.abs(by / maxC - 1);
            const r3 = Math.abs(bz / maxC - 1);
            if (r1 < tolerance && r2 < tolerance && r3 < tolerance && maxC >= 0.8) {
                return '<111>';
            }
        }
    }

    // 1/6<112>: ratio pattern 2:1:1, small magnitude
    {
        const sorted = [bx, by, bz].sort((a, b) => b - a);
        if (sorted[0] >= tolerance && sorted[1] >= tolerance && sorted[2] >= tolerance) {
            const r1 = Math.abs(sorted[0] / sorted[1] - 2);
            const r2 = Math.abs(sorted[1] / sorted[2] - 1);
            if (r1 < tolerance && r2 < tolerance && sorted[0] < 0.4) {
                return '1/6<112>';
            }
        }
    }

    return 'Other';
};

const DISLOCATION_TYPE_COLORS: Record<string, [number, number, number, number]> = {
    'Other': [0.95, 0.1, 0.1, 1.0],
    '1/2<111>': [0.1, 0.9, 0.1, 1.0],
    '<100>': [1, 0.45, 0.74, 1.0],
    '<110>': [0.1, 0.7, 0.95, 1.0],
    '<111>': [0.95, 0.9, 0.1, 1.0],
    '1/6<112>': [0.9, 0.5, 0.1, 1.0],
};

const createLineGeometry = (
    points: [number, number, number][],
    lineWidth: number,
    tubularSegments: number = 8
): { positions: number[]; normals: number[]; indices: number[] } => {
    if (points.length < 2) return { positions: [], normals: [], indices: [] };

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        const dir = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
        const length = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
        if (length < 1e-10) continue;

        dir[0] /= length; dir[1] /= length; dir[2] /= length;

        let up = Math.abs(dir[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
        const right = [
            dir[1] * up[2] - dir[2] * up[1],
            dir[2] * up[0] - dir[0] * up[2],
            dir[0] * up[1] - dir[1] * up[0]
        ];
        const rightLen = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2);
        right[0] /= rightLen; right[1] /= rightLen; right[2] /= rightLen;

        up = [
            dir[1] * right[2] - dir[2] * right[1],
            dir[2] * right[0] - dir[0] * right[2],
            dir[0] * right[1] - dir[1] * right[0]
        ];

        const baseVertexIndex = positions.length / 3;
        const radius = lineWidth * 0.5;

        for (let j = 0; j <= tubularSegments; j++) {
            const angle = (j / tubularSegments) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const offset = [
                (right[0] * cos + up[0] * sin) * radius,
                (right[1] * cos + up[1] * sin) * radius,
                (right[2] * cos + up[2] * sin) * radius
            ];

            positions.push(p1[0] + offset[0], p1[1] + offset[1], p1[2] + offset[2]);
            positions.push(p2[0] + offset[0], p2[1] + offset[1], p2[2] + offset[2]);

            const normalLen = Math.sqrt(offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2);
            if (normalLen > 1e-6) {
                normals.push(offset[0] / normalLen, offset[1] / normalLen, offset[2] / normalLen);
                normals.push(offset[0] / normalLen, offset[1] / normalLen, offset[2] / normalLen);
            } else {
                normals.push(0, 1, 0, 0, 1, 0);
            }
        }

        for (let j = 0; j < tubularSegments; j++) {
            const v1 = baseVertexIndex + j * 2;
            const v2 = baseVertexIndex + j * 2 + 1;
            const v3 = baseVertexIndex + (j + 1) * 2;
            const v4 = baseVertexIndex + (j + 1) * 2 + 1;
            indices.push(v1, v2, v3, v3, v2, v4);
        }
    }

    return { positions, normals, indices };
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
};

/**
 * Maximum number of dislocation vertices before the loop stops accepting
 * new segments.  Each vertex consumes ~24-40 bytes across the typed arrays
 * (positions + normals + optional colors + indices), so 5 M vertices ≈ 200 MB.
 */
const MAX_DISLOCATION_VERTICES = 5_000_000;

/**
 * Estimate the total vertex and index count produced by tube geometry for a
 * set of dislocation segments so we can pre-allocate TypedArrays instead of
 * accumulating into JS `number[]` arrays (which use ~16 bytes per element vs
 * 4 bytes in a Float32Array).
 */
const estimateSegmentGeometry = (
    segments: unknown[],
    tubularSegments: number,
    minSegmentPoints: number
): { vertexCount: number; indexCount: number } => {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const segment of segments) {
        if (!isRecord(segment)) continue;
        const points = Array.isArray(segment.points) ? segment.points : [];
        const validPoints = points.filter(
            (p: unknown): p is number[] => Array.isArray(p) && p.length >= 3
        ).length;
        if (validPoints < minSegmentPoints) continue;

        // Each edge (validPoints - 1) produces (tubularSegments + 1) * 2 vertices
        // and tubularSegments * 6 indices
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
    opts: Required<DislocationExportOptions>
): Promise<ProcessedDislocationGeometry | null> => {
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const typeColors = { ...DISLOCATION_TYPE_COLORS, ...opts.typeColors };

    // Pre-estimate geometry size to allocate TypedArrays up front.
    // This avoids the old pattern of accumulating into JS number[] arrays
    // (~16 bytes/element) and then copying to TypedArrays (~4 bytes/element),
    // which caused 2x peak memory during the copy.
    const estimate = estimateSegmentGeometry(segments, opts.tubularSegments, opts.minSegmentPoints);
    if (estimate.vertexCount === 0) {
        return null;
    }

    const positions = new Float32Array(estimate.vertexCount * 3);
    const normals = new Float32Array(estimate.vertexCount * 3);
    const indices = new Uint32Array(estimate.indexCount);
    const colors = opts.colorByType ? new Float32Array(estimate.vertexCount * 4) : undefined;

    let vertexOffset = 0;    // current write position in positions/normals (vertex count)
    let indexOffset = 0;     // current write position in indices array
    let sinceLastYield = 0;
    let vertexBudgetExhausted = false;

    for (const segment of segments) {
        if (!isRecord(segment)) continue;

        const points = Array.isArray(segment.points) ? segment.points : [];
        const normalizedPoints: [number, number, number][] = points
            .filter((p: unknown): p is number[] => Array.isArray(p) && p.length >= 3)
            .map((p: number[]) => [
                toFiniteNumber(p[0]),
                toFiniteNumber(p[1]),
                toFiniteNumber(p[2])
            ] as [number, number, number]);

        if (normalizedPoints.length < opts.minSegmentPoints) continue;

        const type = calculateDislocationType(segment);

        // Instead of building temporary number[] arrays via createLineGeometry,
        // write directly into the pre-allocated TypedArrays.
        const geometry = createLineGeometry(normalizedPoints, opts.lineWidth, opts.tubularSegments);
        if (geometry.positions.length === 0) continue;

        const segmentVertexCount = geometry.positions.length / 3;
        if (vertexOffset + segmentVertexCount > MAX_DISLOCATION_VERTICES) {
            vertexBudgetExhausted = true;
            break;
        }

        // Copy positions into the typed array
        const posBase = vertexOffset * 3;
        for (let i = 0; i < geometry.positions.length; i++) {
            positions[posBase + i] = geometry.positions[i];
        }

        // Copy normals
        for (let i = 0; i < geometry.normals.length; i++) {
            normals[posBase + i] = geometry.normals[i];
        }

        // Copy indices (offset by current vertex base)
        for (let i = 0; i < geometry.indices.length; i++) {
            indices[indexOffset + i] = geometry.indices[i] + vertexOffset;
        }
        indexOffset += geometry.indices.length;

        // Write per-vertex colors
        if (opts.colorByType && colors) {
            const color = typeColors[type] || typeColors['Other'];
            const colorBase = vertexOffset * 4;
            for (let i = 0; i < segmentVertexCount; i++) {
                const ci = colorBase + i * 4;
                colors[ci] = color[0];
                colors[ci + 1] = color[1];
                colors[ci + 2] = color[2];
                colors[ci + 3] = color[3];
            }
        }

        vertexOffset += segmentVertexCount;

        sinceLastYield++;
        if (sinceLastYield >= 500) {
            sinceLastYield = 0;
            await yieldToEventLoop();
        }
    }

    if (vertexBudgetExhausted) {
        logger.warn(
            { maxVertices: MAX_DISLOCATION_VERTICES, totalSegments: segments.length, processedVertices: vertexOffset },
            'Dislocation vertex budget exhausted — geometry truncated to prevent OOM'
        );
    }

    if (vertexOffset === 0) {
        return null;
    }

    // Trim typed arrays to actual size if estimate was larger than what we used
    const finalPositions = vertexOffset * 3 < positions.length ? positions.subarray(0, vertexOffset * 3) : positions;
    const finalNormals = vertexOffset * 3 < normals.length ? normals.subarray(0, vertexOffset * 3) : normals;
    const finalIndices = indexOffset < indices.length ? indices.subarray(0, indexOffset) : indices;
    const finalColors = colors
        ? (vertexOffset * 4 < colors.length ? colors.subarray(0, vertexOffset * 4) : colors)
        : undefined;

    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < finalPositions.length; i += 3) {
        min[0] = Math.min(min[0], finalPositions[i]);
        min[1] = Math.min(min[1], finalPositions[i + 1]);
        min[2] = Math.min(min[2], finalPositions[i + 2]);
        max[0] = Math.max(max[0], finalPositions[i]);
        max[1] = Math.max(max[1], finalPositions[i + 1]);
        max[2] = Math.max(max[2], finalPositions[i + 2]);
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

/**
 * Convert HSL (all in 0..1 range) to RGB (0..1 range).
 */
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    if (s === 0) return [l, l, l];
    const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        hue2rgb(p, q, h + 1 / 3),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1 / 3)
    ];
};

/**
 * Extended discrete palette with 24 maximally perceptually distinct colors.
 * Hand-picked to remain distinguishable under common colour-vision deficiencies.
 */
const EXTENDED_PALETTE: [number, number, number][] = [
    [0.91, 0.30, 0.24],  //  0  Red
    [0.20, 0.60, 0.86],  //  1  Blue
    [0.18, 0.80, 0.44],  //  2  Green
    [0.95, 0.77, 0.06],  //  3  Yellow
    [0.61, 0.35, 0.71],  //  4  Purple
    [1.00, 0.50, 0.00],  //  5  Orange
    [0.00, 0.81, 0.82],  //  6  Cyan
    [0.85, 0.20, 0.53],  //  7  Magenta/Rose
    [0.55, 0.76, 0.22],  //  8  Lime
    [0.36, 0.25, 0.60],  //  9  Indigo
    [1.00, 0.62, 0.47],  // 10  Salmon
    [0.00, 0.50, 0.50],  // 11  Teal
    [0.80, 0.68, 0.00],  // 12  Dark Yellow / Gold
    [0.44, 0.68, 0.28],  // 13  Olive Green
    [0.69, 0.19, 0.38],  // 14  Crimson
    [0.30, 0.75, 0.93],  // 15  Sky Blue
    [0.90, 0.56, 0.67],  // 16  Pink
    [0.50, 0.50, 0.00],  // 17  Olive
    [0.00, 0.39, 0.74],  // 18  Cobalt
    [0.75, 0.94, 0.27],  // 19  Yellow-Green
    [0.58, 0.00, 0.83],  // 20  Violet
    [0.94, 0.42, 0.31],  // 21  Burnt Orange
    [0.27, 0.94, 0.94],  // 22  Aqua
    [0.66, 0.47, 0.33],  // 23  Brown / Sienna
];

/**
 * Return a colour for the given palette index.
 * Indices within `EXTENDED_PALETTE` get a hand-picked colour; beyond that we
 * generate colours algorithmically using golden-ratio hue spacing to guarantee
 * no two nearby indices share a hue.
 */
const generateColor = (index: number): [number, number, number] => {
    if (index < EXTENDED_PALETTE.length) return EXTENDED_PALETTE[index];

    const GOLDEN_RATIO = 0.618033988749895;
    const hue = ((index - EXTENDED_PALETTE.length) * GOLDEN_RATIO) % 1.0;
    // Vary saturation and lightness slightly so consecutive generated colours
    // differ in more than just hue.
    const saturation = 0.65 + (index % 3) * 0.1;   // 0.65 / 0.75 / 0.85
    const lightness  = 0.45 + (index % 2) * 0.12;   // 0.45 / 0.57
    return hslToRgb(hue, saturation, lightness);
};

/** Regex for cluster names emitted by MultiSOM / clustering nodes, e.g. "Cluster 7". */
const CLUSTER_NAME_RE = /^Cluster\s+(\d+)$/i;

const normalizeDiscreteTypeName = (typeName: string): string => {
    return typeName
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
};

const colorForType = (typeName: string, typeIndex: number): [number, number, number] => {
    // Preserve the historical Structure Identification palette so standalone
    // structure-classification exports match the legacy Volt colouring.
    const predefined: Record<string, [number, number, number]> = {
        bcc: [102 / 255, 102 / 255, 1],
        fcc: [102 / 255, 1, 102 / 255],
        hcp: [1, 102 / 255, 102 / 255],
        dislocation: [1, 0.2, 0.2],
        ico: [1, 165 / 255, 0],
        sc: [160 / 255, 20 / 255, 254 / 255],
        cubic_diamond: [19 / 255, 160 / 255, 254 / 255],
        cubic_diamond_first_neigh: [0, 254 / 255, 245 / 255],
        cubic_diamond_second_neigh: [126 / 255, 254 / 255, 181 / 255],
        hex_diamond: [254 / 255, 137 / 255, 0],
        hex_diamond_first_neigh: [254 / 255, 220 / 255, 0],
        hex_diamond_second_neigh: [204 / 255, 229 / 255, 81 / 255],
        graphene: [50 / 255, 205 / 255, 50 / 255],
        unknown: [128 / 255, 128 / 255, 128 / 255],
        other: [242 / 255, 242 / 255, 242 / 255]
    };

    const normalized = normalizeDiscreteTypeName(typeName);
    if (predefined[normalized]) {
        return predefined[normalized];
    }

    // 2. Cluster-aware colouring: "Cluster N" → use N as palette index directly.
    const clusterMatch = CLUSTER_NAME_RE.exec(typeName);
    if (clusterMatch) {
        const clusterIndex = parseInt(clusterMatch[1], 10);
        return generateColor(clusterIndex);
    }

    // 3. All other types: use the typeIndex through the extended palette / generator.
    return generateColor(typeIndex);
};

const buildPointCloudData = (atomsByType: AtomsGroupedByType): {
    positions: Float32Array;
    colors: Float32Array;
    min: [number, number, number];
    max: [number, number, number];
} => {
    const typeEntries = Object.entries(atomsByType);
    const totalAtoms = typeEntries.reduce((count, [, atoms]) => count + atoms.length, 0);
    if (totalAtoms === 0) {
        throw new Error('No atom data available for export');
    }

    const positions = new Float32Array(totalAtoms * 3);
    const colors = new Float32Array(totalAtoms * 3);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let offset = 0;

    typeEntries.forEach(([typeName, atoms], typeIndex) => {
        const color = colorForType(typeName, typeIndex);
        for (const atom of atoms) {
            const base = offset * 3;
            positions[base] = atom.pos[0];
            positions[base + 1] = atom.pos[1];
            positions[base + 2] = atom.pos[2];
            colors[base] = color[0];
            colors[base + 1] = color[1];
            colors[base + 2] = color[2];
            min[0] = Math.min(min[0], atom.pos[0]);
            min[1] = Math.min(min[1], atom.pos[1]);
            min[2] = Math.min(min[2], atom.pos[2]);
            max[0] = Math.max(max[0], atom.pos[0]);
            max[1] = Math.max(max[1], atom.pos[1]);
            max[2] = Math.max(max[2], atom.pos[2]);
            offset += 1;
        }
    });

    return { positions, colors, min, max };
};

/**
 * Single-pass version: reads raw decoded payload directly into typed arrays,
 * skipping the intermediate PrimitiveAtom[] JS objects that normalizeAtomsByType creates.
 * For 4.5M atoms this saves ~1GB+ of JS heap overhead.
 */
const buildPointCloudDataDirect = async (exportData: Record<string, unknown>): Promise<{
    positions: Float32Array;
    colors: Float32Array;
    min: [number, number, number];
    max: [number, number, number];
} | null> => {
    // First pass: count valid atoms to pre-allocate typed arrays
    const entries: Array<[string, unknown[]]> = [];
    let totalAtoms = 0;
    for (const [typeName, atoms] of Object.entries(exportData)) {
        if (!Array.isArray(atoms)) continue;
        entries.push([typeName, atoms]);
        totalAtoms += atoms.length;
    }
    if (totalAtoms === 0) {
        return null;
    }

    const positions = new Float32Array(totalAtoms * 3);
    const colors = new Float32Array(totalAtoms * 3);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let offset = 0;
    let sinceLastYield = 0;

    for (let entryIdx = 0; entryIdx < entries.length; entryIdx++) {
        const [typeName, atoms] = entries[entryIdx];
        const color = colorForType(typeName, entryIdx);
        for (const atom of atoms) {
            if (!isRecord(atom) || !Array.isArray(atom.pos) || atom.pos.length < 3) {
                continue;
            }
            const x = toFiniteNumber(atom.pos[0]);
            const y = toFiniteNumber(atom.pos[1]);
            const z = toFiniteNumber(atom.pos[2]);
            const base = offset * 3;
            positions[base] = x;
            positions[base + 1] = y;
            positions[base + 2] = z;
            colors[base] = color[0];
            colors[base + 1] = color[1];
            colors[base + 2] = color[2];
            min[0] = Math.min(min[0], x);
            min[1] = Math.min(min[1], y);
            min[2] = Math.min(min[2], z);
            max[0] = Math.max(max[0], x);
            max[1] = Math.max(max[1], y);
            max[2] = Math.max(max[2], z);
            offset++;
            sinceLastYield++;
            if (sinceLastYield >= YIELD_INTERVAL) {
                sinceLastYield = 0;
                await yieldToEventLoop();
            }
        }
    }

    if (offset === 0) {
        return null;
    }

    // Trim if some atoms were invalid and skipped
    if (offset < totalAtoms) {
        return {
            positions: positions.subarray(0, offset * 3),
            colors: colors.subarray(0, offset * 3),
            min,
            max
        };
    }
    return { positions, colors, min, max };
};

const normalizeMesh = (value: Record<string, unknown>): MeshInput => {
    const vertices = Array.isArray(value.vertices) ? value.vertices : [];
    const facets = Array.isArray(value.facets) ? value.facets : [];

    return {
        vertices: vertices
            .map((vertex) => {
                if (!isRecord(vertex) || !Array.isArray(vertex.position) || vertex.position.length < 3) {
                    return null;
                }

                return {
                    index: toFiniteNumber(vertex.index),
                    position: [
                        toFiniteNumber(vertex.position[0]),
                        toFiniteNumber(vertex.position[1]),
                        toFiniteNumber(vertex.position[2])
                    ] as [number, number, number]
                };
            })
            .filter((vertex): vertex is MeshInput['vertices'][number] => vertex !== null),
        facets: facets
            .map((facet) => {
                if (!isRecord(facet) || !Array.isArray(facet.vertices) || facet.vertices.length < 3) {
                    return null;
                }

                return {
                    vertices: [
                        toFiniteNumber(facet.vertices[0]),
                        toFiniteNumber(facet.vertices[1]),
                        toFiniteNumber(facet.vertices[2])
                    ] as [number, number, number]
                };
            })
            .filter((facet): facet is MeshFacet => facet !== null)
    };
};

const computeNormals = (positions: Float32Array, indices: Uint32Array): Float32Array => {
    const normals = new Float32Array(positions.length);

    for (let index = 0; index < indices.length; index += 3) {
        const ia = indices[index] * 3;
        const ib = indices[index + 1] * 3;
        const ic = indices[index + 2] * 3;

        const ax = positions[ia];
        const ay = positions[ia + 1];
        const az = positions[ia + 2];
        const bx = positions[ib];
        const by = positions[ib + 1];
        const bz = positions[ib + 2];
        const cx = positions[ic];
        const cy = positions[ic + 1];
        const cz = positions[ic + 2];

        const abx = bx - ax;
        const aby = by - ay;
        const abz = bz - az;
        const acx = cx - ax;
        const acy = cy - ay;
        const acz = cz - az;

        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;

        normals[ia] += nx;
        normals[ia + 1] += ny;
        normals[ia + 2] += nz;
        normals[ib] += nx;
        normals[ib + 1] += ny;
        normals[ib + 2] += nz;
        normals[ic] += nx;
        normals[ic + 1] += ny;
        normals[ic + 2] += nz;
    }

    for (let index = 0; index < normals.length; index += 3) {
        const nx = normals[index];
        const ny = normals[index + 1];
        const nz = normals[index + 2];
        const length = Math.hypot(nx, ny, nz) || 1;
        normals[index] = nx / length;
        normals[index + 1] = ny / length;
        normals[index + 2] = nz / length;
    }

    return normals;
};

const resolveMaterial = (material: ExportMaterial | undefined, doubleSided?: boolean): ExportMaterial & { doubleSided?: boolean } => {
    return {
        baseColor: material?.baseColor || [0.8, 0.8, 0.85, 1],
        metallic: material?.metallic ?? 0.05,
        roughness: material?.roughness ?? 0.9,
        emissive: material?.emissive || [0, 0, 0],
        doubleSided: doubleSided ?? true
    };
};

const extractChartData = (decodedPayload: Record<string, unknown>, options: ChartExportOptions): ChartPoint[] => {
    const xAxis = getNestedValue(decodedPayload, options.xAxisKey);
    const yAxis = getNestedValue(decodedPayload, options.yAxisKey);

    if (Array.isArray(xAxis) && Array.isArray(yAxis)) {
        return xAxis.map((x, index) => ({
            x: typeof x === 'number' ? x : String(x),
            y: toFiniteNumber(yAxis[index])
        }));
    }

    if (Array.isArray(decodedPayload)) {
        return decodedPayload
            .map((entry) => {
                if (!isRecord(entry)) {
                    return null;
                }

                return {
                    x: typeof entry[options.xAxisKey] === 'number'
                        ? entry[options.xAxisKey]
                        : String(entry[options.xAxisKey]),
                    y: toFiniteNumber(entry[options.yAxisKey])
                };
            })
            .filter((entry): entry is ChartPoint => entry !== null);
    }

    return [];
};

const resolveChartType = (chartType: ChartExportOptions['chartType']): SupportedChartType => {
    if (chartType === 'area') {
        return 'line';
    }

    return chartType;
};

type SupportedChartType = 'line' | 'bar' | 'scatter';

type SupportedChartDatasetValue = number | [number, number] | Point | BubbleDataPoint | null;
const YIELD_INTERVAL = 50_000;

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const buildChartDataset = (
    chartData: ChartPoint[],
    chartType: SupportedChartType,
    options: ChartExportOptions
): ChartDataset<keyof ChartTypeRegistry, SupportedChartDatasetValue[]> => {
    return {
        label: options.title || 'Data',
        data: chartType === 'scatter'
            ? chartData.map((point) => ({ x: Number(point.x), y: point.y }))
            : chartData.map((point) => point.y),
        borderColor: options.lineColor || '#3b82f6',
        backgroundColor: options.fillColor || 'rgba(59, 130, 246, 0.3)',
        fill: options.chartType === 'area',
        tension: 0.1,
        pointRadius: chartType === 'scatter' ? 4 : 2,
        borderWidth: 2
    };
};

export interface ExportNodeProcessorService {
    process(input: ExportExecutionInput): Promise<void>;
};

export const createExportNodeProcessorService = (
    objectStore: ClusterObjectStore,
    nativeModuleLoader: NativeModuleLoader,
    daemonArtifactReporterService: DaemonArtifactReporterService
): ExportNodeProcessorService => {
    const createUploadTarget = (ownerClusterId: string) => createScopedClusterObjectStore(objectStore, ownerClusterId);

    const logSkippedEmptyExport = (
        input: ExportExecutionInput,
        exporter: ExporterName,
        reason: string,
        arrayIndex?: number
    ): void => {
        logger.info(
            {
                analysisId: input.executionData.analysisId,
                exposureName: input.exposure.name,
                exposureNodeId: input.exposure.nodeId,
                exporter,
                timestep: input.timestep,
                ...(arrayIndex != null ? { arrayIndex } : {}),
                reason
            },
            'No exportable results found for exposure export; skipping artifact generation'
        );
    };

    const exportAtomistic = async (
        exportData: Record<string, unknown>,
        objectPath: string,
        ownerClusterId: string
    ): Promise<boolean> => {
        const pointCloud = await buildPointCloudDataDirect(exportData);
        if (!pointCloud) {
            return false;
        }

        const { positions, colors, min, max } = pointCloud;
        const buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(positions, colors, min, max);

        await uploadBufferToObjectStore({
            objectStore: createUploadTarget(ownerClusterId),
            bucket: ObjectBucketName.Models,
            objectKey: objectPath,
            buffer,
            contentType: 'model/gltf-binary',
            tempDirectory: DAEMON_PATHS.analysisOutput,
            tempFilePrefix: 'volt-export'
        });

        return true;
    };

    const exportMesh = async (
        exportData: Record<string, unknown>,
        objectPath: string,
        ownerClusterId: string,
        options: MeshExportOptions
    ): Promise<boolean> => {
        const mesh = normalizeMesh(exportData);
        const material = resolveMaterial(options.material, options.enableDoubleSided);
        const processed = processMesh(mesh, options.smoothIterations);
        if (!processed) {
            return false;
        }
        const buffer = nativeModuleLoader.getExporterModule().generateMeshGLB(
            processed.positions,
            processed.normals,
            processed.indices,
            false,
            undefined,
            processed.bounds,
            material
        );

        await uploadBufferToObjectStore({
            objectStore: createUploadTarget(ownerClusterId),
            bucket: ObjectBucketName.Models,
            objectKey: objectPath,
            buffer,
            contentType: 'model/gltf-binary',
            tempDirectory: DAEMON_PATHS.analysisOutput,
            tempFilePrefix: 'volt-export'
        });

        return true;
    };

    const processMesh = (mesh: MeshInput, smoothIterations?: number): {
        positions: Float32Array;
        normals: Float32Array;
        indices: Uint32Array;
        bounds: {
            minX: number;
            minY: number;
            minZ: number;
            maxX: number;
            maxY: number;
            maxZ: number;
        };
    } | null => {
        if (mesh.vertices.length === 0 || mesh.facets.length === 0) {
            return null;
        }

        const vertexMap = new Map<number, [number, number, number]>();
        for (const vertex of mesh.vertices) {
            vertexMap.set(vertex.index, vertex.position);
        }

        const positions = new Float32Array(mesh.vertices.length * 3);
        const bounds = {
            minX: Infinity,
            minY: Infinity,
            minZ: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
            maxZ: -Infinity
        };

        mesh.vertices.forEach((vertex, index) => {
            const base = index * 3;
            positions[base] = vertex.position[0];
            positions[base + 1] = vertex.position[1];
            positions[base + 2] = vertex.position[2];
            bounds.minX = Math.min(bounds.minX, vertex.position[0]);
            bounds.minY = Math.min(bounds.minY, vertex.position[1]);
            bounds.minZ = Math.min(bounds.minZ, vertex.position[2]);
            bounds.maxX = Math.max(bounds.maxX, vertex.position[0]);
            bounds.maxY = Math.max(bounds.maxY, vertex.position[1]);
            bounds.maxZ = Math.max(bounds.maxZ, vertex.position[2]);
        });

        const vertexIndices = new Map<number, number>();
        mesh.vertices.forEach((vertex, index) => {
            vertexIndices.set(vertex.index, index);
        });

        const indices = new Uint32Array(mesh.facets.length * 3);
        mesh.facets.forEach((facet, index) => {
            const base = index * 3;
            indices[base] = vertexIndices.get(facet.vertices[0]) ?? 0;
            indices[base + 1] = vertexIndices.get(facet.vertices[1]) ?? 0;
            indices[base + 2] = vertexIndices.get(facet.vertices[2]) ?? 0;
        });

        if (smoothIterations && smoothIterations > 0) {
            nativeModuleLoader.getExporterModule().taubinSmooth(positions, indices, smoothIterations);
        }

        const normals = computeNormals(positions, indices);
        return { positions, normals, indices, bounds };
    };

    const exportDislocation = async (
        exportData: Record<string, unknown>,
        objectPath: string,
        ownerClusterId: string,
        options: DislocationExportOptions
    ): Promise<boolean> => {
        const opts: Required<DislocationExportOptions> = {
            lineWidth: options.lineWidth ?? 0.08,
            tubularSegments: options.tubularSegments ?? 12,
            minSegmentPoints: options.minSegmentPoints ?? 2,
            material: {
                baseColor: options.material?.baseColor ?? [1, 1, 1, 1],
                metallic: options.material?.metallic ?? 0.1,
                roughness: options.material?.roughness ?? 0.3,
                emissive: options.material?.emissive ?? [0, 0, 0],
            },
            colorByType: options.colorByType ?? true,
            typeColors: options.typeColors ?? {},
        };

        const geom = await processDislocations(exportData, opts);
        if (!geom) {
            return false;
        }
        const useU16 = geom.vertexCount > 0 && geom.vertexCount <= 65535;
        const idx = useU16 ? new Uint16Array(geom.indices) : geom.indices;

        const buffer = nativeModuleLoader.getExporterModule().generateMeshGLB(
            geom.positions,
            geom.normals,
            idx,
            Boolean(geom.colors),
            geom.colors || undefined,
            {
                minX: geom.bounds.min[0],
                minY: geom.bounds.min[1],
                minZ: geom.bounds.min[2],
                maxX: geom.bounds.max[0],
                maxY: geom.bounds.max[1],
                maxZ: geom.bounds.max[2]
            },
            {
                baseColor: opts.material.baseColor,
                metallic: opts.material.metallic,
                roughness: opts.material.roughness,
                emissive: opts.material.emissive,
                doubleSided: true
            }
        );

        await uploadBufferToObjectStore({
            objectStore: createUploadTarget(ownerClusterId),
            bucket: ObjectBucketName.Models,
            objectKey: objectPath,
            buffer,
            contentType: 'model/gltf-binary',
            tempDirectory: DAEMON_PATHS.analysisOutput,
            tempFilePrefix: 'volt-export'
        });

        return true;
    };

    const exportChart = async (
        decodedPayload: Record<string, unknown>,
        objectPath: string,
        ownerClusterId: string,
        options: ChartExportOptions
    ): Promise<boolean> => {
        const width = options.width || 1200;
        const height = options.height || 800;
        const chartCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: options.backgroundColor || '#1a1a2e'
        });
        const chartData = extractChartData(decodedPayload, options);
        if (chartData.length === 0) {
            return false;
        }

        const chartType = resolveChartType(options.chartType);
        const dataset = buildChartDataset(chartData, chartType, options);
        const chartConfiguration: ChartConfiguration<keyof ChartTypeRegistry, SupportedChartDatasetValue[], string> = {
            type: chartType,
            data: {
                labels: chartType === 'scatter' ? undefined : chartData.map((point) => String(point.x)),
                datasets: [dataset]
            },
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: {
                        display: options.showLegend ?? true,
                        labels: { color: '#ffffff' }
                    },
                    title: {
                        display: Boolean(options.title),
                        text: options.title || '',
                        color: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: Boolean(options.xAxisLabel),
                            text: options.xAxisLabel || '',
                            color: '#ffffff'
                        },
                        grid: {
                            display: options.showGrid ?? true,
                            color: 'rgba(255,255,255,0.1)'
                        },
                        ticks: { color: '#cccccc' }
                    },
                    y: {
                        title: {
                            display: Boolean(options.yAxisLabel),
                            text: options.yAxisLabel || '',
                            color: '#ffffff'
                        },
                        grid: {
                            display: options.showGrid ?? true,
                            color: 'rgba(255,255,255,0.1)'                        },
                        ticks: { color: '#cccccc' }
                    }
                }
            }
        };
        const buffer = await chartCanvas.renderToBuffer(chartConfiguration);

        await uploadBufferToObjectStore({
            objectStore: createUploadTarget(ownerClusterId),
            bucket: ObjectBucketName.Plugins,
            objectKey: objectPath,
            buffer,
            contentType: 'image/png',
            tempDirectory: DAEMON_PATHS.analysisOutput,
            tempFilePrefix: 'volt-export'
        });

        return true;
    };

    /**
     * Resolve the list of exporter payloads from the decoded msgpack data.
     * Supports two shapes:
     *   • Single object:  { export: { AtomisticExporter: { ... } } }
     *   • Array of objects: { export: [ { AtomisticExporter: { ... } }, ... ] }
     *
     * Returns an array of individual exporter objects so callers can iterate uniformly.
     */
    const resolveExporterEntries = (
        decodedPayload: Record<string, unknown>,
        exporter: ExporterName
    ): { exportData: Record<string, unknown>; arrayIndex: number | undefined }[] => {
        const rawExport = decodedPayload['export'];

        if (Array.isArray(rawExport)) {
            // Array format: each element is an exporter object like { AtomisticExporter: { ... } }
            const entries: { exportData: Record<string, unknown>; arrayIndex: number }[] = [];
            for (let i = 0; i < rawExport.length; i++) {
                const element = rawExport[i];
                if (!isRecord(element)) {
                    logger.warn({ index: i, exporter }, 'Skipping non-record element in export array');
                    continue;
                }
                const exporterData = element[exporter];
                if (!isRecord(exporterData)) {
                    logger.warn({ index: i, exporter }, 'Exporter key missing from export array element');
                    continue;
                }
                entries.push({ exportData: exporterData, arrayIndex: i });
            }
            return entries;
        }

        // Single-object format (backward compatible): { AtomisticExporter: { ... } }
        if (isRecord(rawExport)) {
            const exporterData = rawExport[exporter];
            if (!isRecord(exporterData)) {
                return [];
            }
            return [{ exportData: exporterData, arrayIndex: undefined }];
        }

        return [];
    };

    const reportArtifact = (
        input: ExportExecutionInput,
        exporter: ExporterName,
        exportConfig: NonNullable<ExportExecutionInput['exposure']['export']>,
        objectPath: string,
        arrayIndex: number | undefined
    ): void => {
        const displayName = arrayIndex != null
            ? `${input.exposure.name} [${arrayIndex}]`
            : input.exposure.name;

        void daemonArtifactReporterService.reportArtifact({
            trajectory: input.executionData.trajectoryId,
            storageClusterId: input.storageClusterId,
            analysis: input.executionData.analysisId,
            plugin: input.executionData.pluginId,
            sourceType: 'plugin-exposure',
            timestep: input.timestep,
            objectName: objectPath,
            storageBucket: ObjectBucketName.Models,
            params: {
                exposureId: input.exposure.nodeId,
                ...(arrayIndex != null ? { arrayIndex } : {})
            },
            displayName,
            status: 'ready',
            metadata: {
                pluginId: input.executionData.pluginId,
                exposureId: input.exposure.nodeId,
                exposureName: input.exposure.name,
                exporter,
                exportType: exportConfig.type,
                ...(arrayIndex != null ? { arrayIndex } : {})
            }
        }).catch((error) => {
            logger.warn(
                {
                    analysisId: input.executionData.analysisId,
                    exposureId: input.exposure.nodeId,
                    exporter,
                    objectPath,
                    timestep: input.timestep,
                    err: error
                },
                'Failed to report scene artifact metadata to VoltCloud'
            );
        });
    };

    return {
        async process(input) {
            const exportConfig = input.exposure.export;
            if (!exportConfig) {
                return;
            }

            const ownerClusterId = input.executionData.storageClusterId;
            if (!ownerClusterId) {
                throw new Error(`Missing storage owner cluster for analysis export ${input.executionData.analysisId}`);
            }

            const exporter = exportConfig.exporter as ExporterName;
            const options = toStringMap(exportConfig.options);

            // ChartExporter operates on the full decoded payload, not the export key — handle separately
            if (exporter === 'ChartExporter') {
                const objectPath = buildObjectPath(input, exporter, exportConfig.type);
                const exported = await exportChart(
                    input.decodedPayload,
                    objectPath,
                    ownerClusterId,
                    options as unknown as ChartExportOptions
                );
                if (!exported) {
                    logSkippedEmptyExport(input, exporter, 'chart payload had no rows');
                    return;
                }
                return;
            }

            const entries = resolveExporterEntries(input.decodedPayload, exporter);
            if (entries.length === 0) {
                logSkippedEmptyExport(input, exporter, 'exposure payload did not include exportable data');
                return;
            }

            for (const { exportData, arrayIndex } of entries) {
                const objectPath = buildObjectPath(input, exporter, exportConfig.type, arrayIndex);
                let exported = false;

                switch (exporter) {
                    case 'AtomisticExporter':
                        exported = await exportAtomistic(exportData, objectPath, ownerClusterId);
                        break;
                    case 'MeshExporter':
                        exported = await exportMesh(exportData, objectPath, ownerClusterId, options as MeshExportOptions);
                        break;
                    case 'DislocationExporter':
                        exported = await exportDislocation(exportData, objectPath, ownerClusterId, options as DislocationExportOptions);
                        break;
                    default:
                        logger.warn({ exporter }, 'Unsupported export node exporter on daemon');
                        return;
                }

                if (!exported) {
                    logSkippedEmptyExport(input, exporter, 'export data was present but contained no results', arrayIndex);
                    continue;
                }

                reportArtifact(input, exporter, exportConfig, objectPath, arrayIndex);
            }

            daemonArtifactReporterService.flushPendingArtifacts();
        }
    };
};
