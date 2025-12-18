/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Document, Accessor } from '@gltf-transform/core';
import { AtomsGroupedByType } from '@/types/utilities/export/atoms';
import { applyQuantizeAndMeshopt, writeGLBToBuffer } from '@/utilities/export/gltf-pipeline';
import encodeMorton from '@/utilities/export/morton';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import TrajectoryParserFactory from '@/parsers/factory';
import { ParseResult } from '@/types/parser';
import GradientFactory from './gradient-factory';

/**
 * Options that control quantization and compression of the exported GLB.
 */
export type CompressionOptions = {
    /**
     * glTF-Transform quantization options for vertex attributes.
     */
    quantization?: {
        /**
         * Number of bits used to quantize position attributes.
         */
        positionBits?: number;
        /**
         * Number of bits used to quantize color attributes.
         */
        colorBits?: number;
    };
    /**
     * Whether primitives should be grouped per atom type.
     * If omitted, a heuristic is used based on the number of unique types.
     */
    perTypePrimitives?: boolean;
    /**
     * Epsilon parameter forwarded to the mesh optimization pipeline.
     */
    epsilon?: number;
    /**
     * Number of bits used per axis when computing Morton codes.
     * Morton reordering is always enabled; this value only changes precision.
     */
    maxMortonBitsPerAxis?: number;
    /**
     * Whether additional meshopt optimization should be applied.
     * The flag is kept for API compatibility; the actual behavior is defined
     * inside the glTF pipeline helper.
     */
    meshopt?: boolean;
};

export default class AtomisticExporter {
    private readonly lammpsTypeColors: Map<number, number[]> = new Map([
        [0, [0.5, 0.5, 0.5, 1.0]],
        [1, [1.0, 0.267, 0.267, 1.0]],
        [2, [0.267, 1.0, 0.267, 1.0]],
        [3, [0.267, 0.267, 1.0, 1.0]],
        [4, [1.0, 1.0, 0.267, 1.0]],
        [5, [1.0, 0.267, 1.0, 1.0]],
        [6, [0.267, 1.0, 1.0, 1.0]]
    ]);

    private readonly STRUCTURE_COLORS: { [key: string]: number[] } = {
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

    private async parseToTypedArrays(filePath: string): Promise<{
        positions: Float32Array;
        types: Uint16Array;
        min: [number, number, number];
        max: [number, number, number];
    }> {
        const parsed: ParseResult = await TrajectoryParserFactory.parse(filePath);
        return {
            positions: parsed.positions,
            types: parsed.types,
            min: parsed.min,
            max: parsed.max
        };
    }

    private static reorderByOrder(
        order: Uint32Array,
        positions: Float32Array,
        types?: Uint16Array,
        colors?: Float32Array
    ) {
        const n = order.length;
        const pos2 = new Float32Array(n * 3);

        for (let i = 0; i < n; i++) {
            const src = order[i] * 3;
            const dst = i * 3;
            pos2[dst] = positions[src];
            pos2[dst + 1] = positions[src + 1];
            pos2[dst + 2] = positions[src + 2];
        }

        let types2: Uint16Array | undefined;
        if (types) {
            types2 = new Uint16Array(n);
            for (let i = 0; i < n; i++) {
                types2[i] = types[order[i]];
            }
        }

        let colors2: Float32Array | undefined;
        if (colors) {
            colors2 = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                const src = order[i] * 3;
                const dst = i * 3;
                colors2[dst] = colors[src];
                colors2[dst + 1] = colors[src + 1];
                colors2[dst + 2] = colors[src + 2];
            }
        }

        return {
            positions: pos2,
            types: types2,
            colors: colors2
        };
    }

    private static radixSortByMorton(idx: Uint32Array, mortonKeys: Uint32Array): void {
        const n = idx.length;
        if (n <= 1) return;

        const tmp = new Uint32Array(n);
        const RADIX = 256;
        const count = new Uint32Array(RADIX);

        for (let shift = 0; shift < 32; shift += 8) {
            count.fill(0);

            for (let i = 0; i < n; i++) {
                const key = mortonKeys[idx[i]];
                const bucket = (key >>> shift) & 0xff;
                count[bucket]++;
            }

            let sum = 0;
            for (let i = 0; i < RADIX; i++) {
                const c = count[i];
                count[i] = sum + c;
                sum += c;
            }

            for (let i = n - 1; i >= 0; i--) {
                const index = idx[i];
                const key = mortonKeys[index];
                const bucket = (key >>> shift) & 0xff;
                const pos = --count[bucket];
                tmp[pos] = index;
            }

            idx.set(tmp);
        }
    }

    private async createGLB(
        positions: Float32Array,
        min: [number, number, number],
        max: [number, number, number],
        opts: CompressionOptions,
        colors?: Float32Array
    ): Promise<Uint8Array> {
        const extent = {
            x: Math.max(1e-20, max[0] - min[0]),
            y: Math.max(1e-20, max[1] - min[1]),
            z: Math.max(1e-20, max[2] - min[2])
        };

        const doc = new Document();
        const buffer = doc.createBuffer('bin');

        const posAcc = doc
            .createAccessor('POSITION')
            .setArray(positions)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const prim = doc
            .createPrimitive()
            .setAttribute('POSITION', posAcc)
            .setMode(0);

        if (colors) {
            const colAcc = doc
                .createAccessor('COLOR_0')
                .setArray(colors)
                .setType(Accessor.Type.VEC3)
                .setBuffer(buffer);
            prim.setAttribute('COLOR_0', colAcc);
        }

        const mesh = doc.createMesh('AtomsByProperty').addPrimitive(prim);
        const node = doc.createNode('Frame').setMesh(mesh);
        doc.createScene('Scene').addChild(node);

        doc.createMaterial('PointMat');

        await applyQuantizeAndMeshopt(
            doc,
            {
                quantization: {
                    positionBits: opts.quantization?.positionBits ?? 15,
                    colorBits: opts.quantization?.colorBits ?? 8
                },
                epsilon: opts.epsilon,
                requireExtensions: true
            },
            extent
        );

        return writeGLBToBuffer(doc);
    }

    public async exportColoredByProperty(
        filePath: string,
        minioObjectName: string,
        property: string,
        startValue: number,
        endValue: number,
        gradientName: string,
        opts: CompressionOptions = {},
        externalValues?: Float32Array
    ): Promise<void> {
        const parseOptions: any = {};
        // If there are external values, we need the dump IDs to cross-reference them.
        if (externalValues) {
            parseOptions.includeIds = true;
        } else {
            parseOptions.properties = [property];
        }
        const parsed = await TrajectoryParserFactory.parse(filePath, parseOptions);
        const natoms = parsed.metadata.natoms;

        const lut = GradientFactory.getGradientLUT(gradientName);
        const lutMaxIndex = GradientFactory.LUT_SIZE - 1;

        const range = endValue - startValue;
        const invRange = range !== 0 ? 1 / range : 0;
        const colors = new Float32Array(natoms * 3);

        let getValue: (index: number) => number;
        if (externalValues) {
            if (!parsed.ids) throw new Error('Atom IDs required for external values mapping');
            const ids = parsed.ids;
            const extVals = externalValues;
            getValue = (i: number) => {
                const atomId = ids[i];
                return extVals[atomId];
            };
        } else {
            const propertyValues = parsed.properties![property];
            getValue = (i: number) => {
                return propertyValues[i];
            };
        }

        for (let i = 0; i < natoms; i++) {
            const value = getValue(i);
            let t = (value - startValue) * invRange;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            else if (!(t === t)) t = 0;

            const lutIndex = (t * lutMaxIndex) | 0;
            const colorBase = lutIndex * 3;
            const destBase = i * 3;
            colors[destBase] = lut[colorBase];
            colors[destBase + 1] = lut[colorBase + 1];
            colors[destBase + 2] = lut[colorBase + 2];
        }

        const glbBuffer = await this.createGLB(
            parsed.positions,
            parsed.min,
            parsed.max,
            opts,
            colors
        );

        await storage.put(SYS_BUCKETS.MODELS, minioObjectName, Buffer.from(glbBuffer), {
            'Content-Type': 'model/gltf-binary'
        });
    }

    private static countingSortByType(idx: Uint32Array, types: Uint16Array): void {
        const n = idx.length;
        if (n <= 1) return;

        let maxType = 0;
        for (let i = 0; i < n; i++) {
            const t = types[idx[i]];
            if (t > maxType) maxType = t;
        }

        const count = new Uint32Array(maxType + 1);

        for (let i = 0; i < n; i++) {
            count[types[idx[i]]]++;
        }

        let sum = 0;
        for (let i = 0; i <= maxType; i++) {
            const c = count[i];
            count[i] = sum + c;
            sum += c;
        }

        const tmp = new Uint32Array(n);
        for (let i = n - 1; i >= 0; i--) {
            const index = idx[i];
            const t = types[index];
            const pos = --count[t];
            tmp[pos] = index;
        }

        idx.set(tmp);
    }

    // Removed toGLB method - use toGLBMinIO instead

    public async toGLBBuffer(
        filePath: string,
        optsOrLegacy?: CompressionOptions | Function,
        maybeOpts?: CompressionOptions
    ): Promise<Buffer> {
        const opts = (typeof optsOrLegacy === 'function') ? (maybeOpts ?? {}) : (optsOrLegacy ?? {});
        const mortonBits = Math.max(1, opts.maxMortonBitsPerAxis ?? 10);

        const { positions, types, min, max } = await this.parseToTypedArrays(filePath);

        const extent = {
            x: Math.max(1e-20, max[0] - min[0]),
            y: Math.max(1e-20, max[1] - min[1]),
            z: Math.max(1e-20, max[2] - min[2])
        };

        const n = positions.length / 3;
        const idx = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
            idx[i] = i;
        }

        let uniqueTypesCount = 0;
        {
            const seen = new Set<number>();
            for (let i = 0; i < n; i++) {
                seen.add(types[i]);
            }
            uniqueTypesCount = seen.size;
        }

        const perTypePrimitives = opts.perTypePrimitives ?? (uniqueTypesCount <= 16);
        const mortonKeys = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
            const p = i * 3;
            const nx = (positions[p] - min[0]) / extent.x;
            const ny = (positions[p + 1] - min[1]) / extent.y;
            const nz = (positions[p + 2] - min[2]) / extent.z;
            mortonKeys[i] = encodeMorton(nx, ny, nz, mortonBits);
        }

        AtomisticExporter.radixSortByMorton(idx, mortonKeys);
        if (perTypePrimitives) {
            AtomisticExporter.countingSortByType(idx, types);
        }

        const reordered = AtomisticExporter.reorderByOrder(idx, positions, types);
        const posR = reordered.positions;
        const typesR = reordered.types!;

        const doc = new Document();
        const buffer = doc.createBuffer('bin');

        const positionAcc = doc
            .createAccessor('POSITION')
            .setArray(posR)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const colors = new Float32Array(n * 3);
        const colorCache = new Map<number, [number, number, number]>();

        for (let i = 0, p = 0; i < n; i++) {
            const t = typesR[i];
            let rgb = colorCache.get(t);

            if (!rgb) {
                const c = this.lammpsTypeColors.get(t) || [0.6, 0.6, 0.6, 1];
                rgb = [c[0], c[1], c[2]];
                colorCache.set(t, rgb);
            }

            colors[p++] = rgb[0];
            colors[p++] = rgb[1];
            colors[p++] = rgb[2];
        }

        const colorAcc = doc
            .createAccessor('COLOR_0')
            .setArray(colors)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const primitive = doc
            .createPrimitive()
            .setAttribute('POSITION', positionAcc)
            .setAttribute('COLOR_0', colorAcc)
            .setMode(0);

        const mesh = doc.createMesh('Atoms').addPrimitive(primitive);
        doc.createMaterial('PointMat');

        const node = doc.createNode('Frame').setMesh(mesh);
        doc.createScene('Scene').addChild(node);

        await applyQuantizeAndMeshopt(
            doc,
            {
                quantization: {
                    positionBits: opts.quantization?.positionBits ?? 15,
                    colorBits: opts.quantization?.colorBits ?? 8
                },
                epsilon: opts.epsilon,
                requireExtensions: true
            },
            extent
        );

        return await writeGLBToBuffer(doc);
    }

    public async toGLBMinIO(
        filePath: string,
        minioObjectName: string,
        optsOrLegacy?: CompressionOptions | Function
    ): Promise<void> {
        const opts = (typeof optsOrLegacy === 'function') ? {} : (optsOrLegacy ?? {});
        const buffer = await this.toGLBBuffer(filePath, opts);
        await storage.put(SYS_BUCKETS.MODELS, minioObjectName, buffer, {
            'Content-Type': 'model/gltf-binary'
        });
    }

    public async exportAtomsTypeToGLBBuffer(
        atomsByType: AtomsGroupedByType,
        opts: CompressionOptions = {}
    ): Promise<Buffer> {
        const totalAtoms = Object.values(atomsByType).reduce((s, list) => s + list.length, 0);
        const positions = new Float32Array(totalAtoms * 3);
        const colors = new Float32Array(totalAtoms * 3);

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        let cursor = 0;
        let grainColorIndex = 0;
        const GRAIN_PALETTE = [
            [230, 51, 51],   // Red
            [51, 204, 51],   // Green
            [51, 102, 230],  // Blue
            [242, 191, 25],  // Yellow
            [217, 51, 217],  // Magenta
            [25, 217, 217],  // Cyan
            [255, 140, 25],  // Orange
            [153, 51, 230],  // Purple
            [25, 140, 25],   // Dark Green
            [179, 128, 89],  // Brown
            [242, 140, 166], // Pink
            [115, 191, 217], // Sky Blue
        ];

        for (const [typeName, atoms] of Object.entries(atomsByType)) {
            const key = typeName.toUpperCase().replace(/ /g, '_');

            // Dynamic color for grain keys
            let rgbInts: number[];
            if (typeName.startsWith('Grain_')) {
                rgbInts = GRAIN_PALETTE[grainColorIndex % GRAIN_PALETTE.length];
                grainColorIndex++;
            } else {
                rgbInts = this.STRUCTURE_COLORS[key] || this.STRUCTURE_COLORS['OTHER'];
            }
            const rgb = [rgbInts[0] / 255, rgbInts[1] / 255, rgbInts[2] / 255];

            for (let i = 0; i < atoms.length; i++) {
                const idxBase = (cursor + i) * 3;
                const a = atoms[i];
                const x = a.pos[0];
                const y = a.pos[1];
                const z = a.pos[2];

                positions[idxBase] = x;
                positions[idxBase + 1] = y;
                positions[idxBase + 2] = z;

                colors[idxBase] = rgb[0];
                colors[idxBase + 1] = rgb[1];
                colors[idxBase + 2] = rgb[2];

                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (z < minZ) minZ = z;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
                if (z > maxZ) maxZ = z;
            }

            cursor += atoms.length;
        }

        const extent = {
            x: Math.max(1e-20, maxX - minX),
            y: Math.max(1e-20, maxY - minY),
            z: Math.max(1e-20, maxZ - minZ)
        };

        const doc = new Document();
        const buffer = doc.createBuffer('bin');

        const posAcc = doc
            .createAccessor('POSITION')
            .setArray(positions)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const colAcc = doc
            .createAccessor('COLOR_0')
            .setArray(colors)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const prim = doc
            .createPrimitive()
            .setAttribute('POSITION', posAcc)
            .setAttribute('COLOR_0', colAcc)
            .setMode(0);

        const mesh = doc.createMesh('AtomsByType').addPrimitive(prim);
        const node = doc.createNode('Frame').setMesh(mesh);
        doc.createScene('Scene').addChild(node);

        doc.createMaterial('PointMat');

        await applyQuantizeAndMeshopt(
            doc,
            {
                quantization: {
                    positionBits: opts.quantization?.positionBits ?? 15,
                    colorBits: opts.quantization?.colorBits ?? 8
                },
                epsilon: opts.epsilon,
                requireExtensions: true
            },
            extent
        );

        return await writeGLBToBuffer(doc);
    }

    public async exportAtomsTypeToGLBMinIO(
        atomsByType: AtomsGroupedByType,
        minioObjectName: string,
        opts: CompressionOptions = {}
    ): Promise<void> {
        const buffer = await this.exportAtomsTypeToGLBBuffer(atomsByType, opts);
        await storage.put(SYS_BUCKETS.MODELS, minioObjectName, buffer, {
            'Content-Type': 'model/gltf-binary'
        });
    }
};
