import path from 'node:path';

import type { NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';

import { buildArtifactReportInput, ExportExecutionInput, ObjectBucketName, YIELD_INTERVAL, isRecord, yieldToEventLoop } from '@/modules/plugin/application/exports/ExportNodeProcessor.shared';

const readFiniteCoordinate = (value: unknown): number | null => {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : null;
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    if (s === 0) {
        return [l, l, l];
    }

    const hueToRgb = (p: number, q: number, t: number): number => {
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
        hueToRgb(p, q, h + 1 / 3),
        hueToRgb(p, q, h),
        hueToRgb(p, q, h - 1 / 3)
    ];
};

const EXTENDED_PALETTE: [number, number, number][] = [
    [0.91, 0.30, 0.24],
    [0.20, 0.60, 0.86],
    [0.18, 0.80, 0.44],
    [0.95, 0.77, 0.06],
    [0.61, 0.35, 0.71],
    [1.00, 0.50, 0.00],
    [0.00, 0.81, 0.82],
    [0.85, 0.20, 0.53],
    [0.55, 0.76, 0.22],
    [0.36, 0.25, 0.60],
    [1.00, 0.62, 0.47],
    [0.00, 0.50, 0.50],
    [0.80, 0.68, 0.00],
    [0.44, 0.68, 0.28],
    [0.69, 0.19, 0.38],
    [0.30, 0.75, 0.93],
    [0.90, 0.56, 0.67],
    [0.50, 0.50, 0.00],
    [0.00, 0.39, 0.74],
    [0.75, 0.94, 0.27],
    [0.58, 0.00, 0.83],
    [0.94, 0.42, 0.31],
    [0.27, 0.94, 0.94],
    [0.66, 0.47, 0.33]
];

const CLUSTER_NAME_RE = /^Cluster\s+(\d+)$/i;

const generateColor = (index: number): [number, number, number] => {
    if (index < EXTENDED_PALETTE.length) {
        return EXTENDED_PALETTE[index];
    }

    const goldenRatio = 0.618033988749895;
    const hue = ((index - EXTENDED_PALETTE.length) * goldenRatio) % 1.0;
    const saturation = 0.65 + (index % 3) * 0.1;
    const lightness = 0.45 + (index % 2) * 0.12;
    return hslToRgb(hue, saturation, lightness);
};

const colorForType = (typeName: string, typeIndex: number): [number, number, number] => {
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

    const normalized = typeName.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (predefined[normalized]) {
        return predefined[normalized];
    }

    const clusterMatch = CLUSTER_NAME_RE.exec(typeName);
    if (clusterMatch) {
        return generateColor(Number.parseInt(clusterMatch[1], 10));
    }

    return generateColor(typeIndex);
};

const buildPointCloudDataDirect = async (exportData: Record<string, unknown>): Promise<{
    positions: Float32Array;
    colors: Float32Array;
    min: [number, number, number];
    max: [number, number, number];
} | null> => {
    const entries: Array<[string, unknown[]]> = [];
    let totalAtoms = 0;

    for (const [typeName, atoms] of Object.entries(exportData)) {
        if (!Array.isArray(atoms)) {
            continue;
        }

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

    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const [typeName, atoms] = entries[entryIndex];
        const color = colorForType(typeName, entryIndex);

        for (const atom of atoms) {
            if (!isRecord(atom) || !Array.isArray(atom.pos) || atom.pos.length < 3) {
                continue;
            }

            const x = readFiniteCoordinate(atom.pos[0]);
            const y = readFiniteCoordinate(atom.pos[1]);
            const z = readFiniteCoordinate(atom.pos[2]);
            if (x === null || y === null || z === null) {
                continue;
            }

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
            offset += 1;
            sinceLastYield += 1;
            if (sinceLastYield >= YIELD_INTERVAL) {
                sinceLastYield = 0;
                await yieldToEventLoop();
            }
        }
    }

    if (offset === 0) {
        return null;
    }

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

export const exportAtomisticArtifact = async (
    nativeModuleLoader: NativeModuleLoader,
    input: ExportExecutionInput,
    exportData: Record<string, unknown>,
    objectPath: string,
    ownerClusterId: string
): Promise<boolean> => {
    const pointCloud = await buildPointCloudDataDirect(exportData);
    if (!pointCloud) {
        return false;
    }

    const buffer = nativeModuleLoader.getExporterModule().generatePointCloudGLB(
        pointCloud.positions,
        pointCloud.colors,
        pointCloud.min,
        pointCloud.max
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
            'AtomisticExporter',
            input.exposure.export!,
            objectPath,
            ObjectBucketName.Models
        )
    });

    return true;
};
