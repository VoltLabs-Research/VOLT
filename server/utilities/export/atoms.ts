import * as path from 'path';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { AtomsGroupedByType } from '@/types/utilities/export/atoms';
import exporter, { GradientType } from '@/utilities/export/exporter';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import TrajectoryParserFactory from '@/parsers/factory';
import tempFileManager from '@/services/temp-file-manager';

const FILE_THRESHOLD = 50_000_000;

export default class AtomisticExporter {
    private readonly STRUCTURE_COLORS: Record<string, number[]> = {
        'FCC': [102, 255, 102],
        'HCP': [255, 102, 102],
        'BCC': [102, 102, 255],
        'ICO': [255, 165, 0],
        'SC': [160, 20, 254],
        'CUBIC_DIAMOND': [19, 160, 254],
        'CUBIC_DIAMOND_FIRST_NEIGH': [0, 254, 245],
        'CUBIC_DIAMOND_SECOND_NEIGH': [126, 254, 181],
        'HEX_DIAMOND': [254, 137, 0],
        'HEX_DIAMOND_FIRST_NEIGH': [254, 220, 0],
        'HEX_DIAMOND_SECOND_NEIGH': [204, 229, 81],
        'GRAPHENE': [50, 205, 50],
        'UNKNOWN': [128, 128, 128],
        'OTHER': [242, 242, 242]
    };

    private readonly GRAIN_PALETTE = [
        [230, 51, 51], [51, 204, 51], [51, 102, 230], [242, 191, 25],
        [217, 51, 217], [25, 217, 217], [255, 140, 25], [153, 51, 230],
        [25, 140, 25], [179, 128, 89], [242, 140, 166], [115, 191, 217]
    ];

    public async toGLBMinIO(filePath: string, objectName: string): Promise<void> {
        const parsed = await TrajectoryParserFactory.parse(filePath);
        const atomCount = parsed.positions.length / 3;

        if (atomCount > FILE_THRESHOLD) {
            const tempFile = tempFileManager.generateFilePath({ prefix: 'glb_', extension: '.glb' });
            try {
                const success = exporter.generateGLBToFile(parsed.positions, parsed.types, parsed.min, parsed.max, tempFile);
                if (!success) throw new Error('Native GLB generation failed');
                await storage.put(SYS_BUCKETS.MODELS, objectName, createReadStream(tempFile), { 'Content-Type': 'model/gltf-binary' });
            } finally {
                await unlink(tempFile).catch(() => { });
            }
        } else {
            const buffer = exporter.generateGLB(parsed.positions, parsed.types, parsed.min, parsed.max);
            await storage.put(SYS_BUCKETS.MODELS, objectName, buffer, { 'Content-Type': 'model/gltf-binary' });
        }
    }

    public async exportColoredByProperty(
        filePath: string,
        objectName: string,
        property: string,
        startValue: number,
        endValue: number,
        gradientName: string,
        externalValues?: Float32Array
    ): Promise<void> {
        const parseOpts: any = externalValues ? { includeIds: true } : { properties: [property] };
        const parsed = await TrajectoryParserFactory.parse(filePath, parseOpts);

        const gradientMap: Record<string, GradientType> = {
            'Viridis': GradientType.Viridis,
            'Plasma': GradientType.Plasma,
            'Blue-Red': GradientType.BlueRed,
            'Grayscale': GradientType.Grayscale
        };
        const gradientType = gradientMap[gradientName] ?? GradientType.Viridis;

        let colors: Float32Array;
        if (externalValues) {
            if (!parsed.ids) throw new Error('Atom IDs required for external values');
            const values = new Float32Array(parsed.metadata.natoms);
            for (let i = 0; i < parsed.metadata.natoms; i++) {
                values[i] = externalValues[parsed.ids[i]];
            }
            colors = exporter.applyPropertyColors(values, startValue, endValue, gradientType);
        } else {
            colors = exporter.applyPropertyColors(parsed.properties![property], startValue, endValue, gradientType);
        }

        const buffer = exporter.generatePointCloudGLB(parsed.positions, colors, parsed.min, parsed.max);
        await storage.put(SYS_BUCKETS.MODELS, objectName, buffer, { 'Content-Type': 'model/gltf-binary' });
    }

    public async exportAtomsTypeToGLBBuffer(atomsByType: AtomsGroupedByType): Promise<Buffer> {
        const totalAtoms = Object.values(atomsByType).reduce((s, list) => s + list.length, 0);
        const positions = new Float32Array(totalAtoms * 3);
        const colors = new Float32Array(totalAtoms * 3);

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        let cursor = 0, grainIdx = 0;

        for (const [typeName, atoms] of Object.entries(atomsByType)) {
            const key = typeName.toUpperCase().replace(/ /g, '_');
            let rgb: number[];
            if (typeName.startsWith('Grain_')) {
                rgb = this.GRAIN_PALETTE[grainIdx++ % this.GRAIN_PALETTE.length];
            } else {
                rgb = this.STRUCTURE_COLORS[key] || this.STRUCTURE_COLORS['OTHER'];
            }
            const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;

            for (let i = 0; i < atoms.length; i++) {
                const a = atoms[i];
                const x = a.pos[0], y = a.pos[1], z = a.pos[2];
                positions[(cursor + i) * 3] = x;
                positions[(cursor + i) * 3 + 1] = y;
                positions[(cursor + i) * 3 + 2] = z;
                colors[(cursor + i) * 3] = r;
                colors[(cursor + i) * 3 + 1] = g;
                colors[(cursor + i) * 3 + 2] = b;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
            cursor += atoms.length;
        }

        // Use native point cloud GLB generation
        return exporter.generatePointCloudGLB(positions, colors, [minX, minY, minZ], [maxX, maxY, maxZ]);
    }

    public async exportAtomsTypeToGLBMinIO(atomsByType: AtomsGroupedByType, objectName: string): Promise<void> {
        const buffer = await this.exportAtomsTypeToGLBBuffer(atomsByType);
        await storage.put(SYS_BUCKETS.MODELS, objectName, buffer, { 'Content-Type': 'model/gltf-binary' });
    }
}
