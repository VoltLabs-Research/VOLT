/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { Document, Accessor } from '@gltf-transform/core';
import { AtomsGroupedByType } from '@/types/utilities/export/atoms';
import { readLargeFile } from '@/utilities/fs';
import { applyQuantizeAndMeshopt, writeGLB } from '@/utilities/export/gltf-pipeline';
import { computeBoundsFromFlat } from '@/utilities/export/bounds';
import encodeMorton from '@/utilities/export/morton';

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

export default class AtomisticExporter{
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
        'SC': [160, 20, 254],
        'CUBIC_DIAMOND': [19, 160, 254],
        'CUBIC_DIAMOND_FIRST_NEIGH': [0, 254, 245],
        'CUBIC_DIAMOND_SECOND_NEIGH': [126, 254, 181],
        'HEX_DIAMOND_FIRST_NEIGH': [254, 220, 0],
        'HEX_DIAMOND_SECOND_NEIGH': [204, 229, 81],
        'HEX_DIAMOND': [254, 137, 0],
        'OTHER': [242, 242, 242]
    };

    private async parseToTypedArrays(
        filePath: string,
        extractTimestepInfo: Function
    ): Promise<{
        timestepInfo: any;
        positions: Float32Array;
        types: Uint16Array;
        min: [number, number, number];
        max: [number, number, number];
    }> {
        let inAtoms = false;
        let headerCols: string[] = [];
        let headerColsLower: string[] = [];
        let idxType = -1;
        let idxX = -1;
        let idxY = -1;
        let idxZ = -1;

        const headLines: string[] = [];
        const positionsArray: number[] = [];
        const typesArray: number[] = [];

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        await readLargeFile(filePath, {
            onLine: (line: string) => {
                if(headLines.length < 1000){
                    headLines.push(line);
                }

                const t = line.trim();
                if(!t) return;

                if(t.startsWith('ITEM: ATOMS')){
                    headerCols = t.replace(/^ITEM:\s*ATOMS\s*/, '').trim().split(/\s+/);
                    headerColsLower = headerCols.map((c) => c.toLowerCase());

                    const colIndex = (names: string[]): number => {
                        for(let i = 0; i < names.length; i++){
                            const idx = headerColsLower.indexOf(names[i]);
                            if(idx !== -1) return idx;
                        }
                        return -1;
                    };

                    idxType = colIndex(['type']);
                    idxX = colIndex(['x', 'xu', 'xs', 'xsu']);
                    idxY = colIndex(['y', 'yu', 'ys', 'ysu']);
                    idxZ = colIndex(['z', 'zu', 'zs', 'zsu']);

                    if(idxType < 0 || idxX < 0 || idxY < 0 || idxZ < 0){
                        throw new Error(`Unsupported ATOMS columns: ${headerCols.join(' ')}`);
                    }

                    inAtoms = true;
                    return;
                }

                if(t.startsWith('ITEM:')){
                    inAtoms = false;
                    return;
                }

                if(!inAtoms) return;

                const parts = t.split(/\s+/);
                if(parts.length < headerCols.length) return;

                const typeVal = (+parts[idxType]) | 0;
                const x = +parts[idxX];
                const y = +parts[idxY];
                const z = +parts[idxZ];

                typesArray.push(typeVal);
                positionsArray.push(x, y, z);

                if(x < minX) minX = x;
                if(y < minY) minY = y;
                if(z < minZ) minZ = z;
                if(x > maxX) maxX = x;
                if(y > maxY) maxY = y;
                if(z > maxZ) maxZ = z;
            }
        });

        const count = typesArray.length;
        if(count === 0){
            throw new Error('No atoms found');
        }

        const timestepInfo = extractTimestepInfo(headLines);
        if(!timestepInfo){
            throw new Error('Can not extract TIMESTEP');
        }

        const positions = new Float32Array(count * 3);
        const types = new Uint16Array(count);

        let srcPos = 0;
        for(let i = 0; i < count; i++){
            const base = i * 3;
            types[i] = typesArray[i];
            positions[base] = positionsArray[srcPos++];
            positions[base + 1] = positionsArray[srcPos++];
            positions[base + 2] = positionsArray[srcPos++];
        }

        return {
            timestepInfo,
            positions,
            types,
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ]
        };
    }

    private static reorderByOrder(
        order: Uint32Array,
        positions: Float32Array,
        types?: Uint16Array,
        colors?: Float32Array
    ){
        const n = order.length;
        const pos2 = new Float32Array(n * 3);

        for(let i = 0; i < n; i++){
            const src = order[i] * 3;
            const dst = i * 3;
            pos2[dst] = positions[src];
            pos2[dst + 1] = positions[src + 1];
            pos2[dst + 2] = positions[src + 2];
        }

        let types2: Uint16Array | undefined;
        if(types){
            types2 = new Uint16Array(n);
            for(let i = 0; i < n; i++){
                types2[i] = types[order[i]];
            }
        }

        let colors2: Float32Array | undefined;
        if(colors){
            colors2 = new Float32Array(n * 3);
            for(let i = 0; i < n; i++){
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

    private static radixSortByMorton(idx: Uint32Array, mortonKeys: Uint32Array): void{
        const n = idx.length;
        if(n <= 1) return;

        const tmp = new Uint32Array(n);
        const RADIX = 256;
        const count = new Uint32Array(RADIX);

        for(let shift = 0; shift < 32; shift += 8){
            count.fill(0);

            for(let i = 0; i < n; i++){
                const key = mortonKeys[idx[i]];
                const bucket = (key >>> shift) & 0xff;
                count[bucket]++;
            }


            let sum = 0;
            for(let i = 0; i < RADIX; i++){
                const c = count[i];
                count[i] = sum + c;
                sum += c;
            }

            for(let i = n - 1; i >= 0; i--){
                const index = idx[i];
                const key = mortonKeys[index];
                const bucket = (key >>> shift) & 0xff;
                const pos = --count[bucket];
                tmp[pos] = index;
            }

            idx.set(tmp);
        }
    }

    private static countingSortByType(idx: Uint32Array, types: Uint16Array): void{
        const n = idx.length;
        if(n <= 1) return;

        let maxType = 0;
        for(let i = 0; i < n; i++){
            const t = types[idx[i]];
            if(t > maxType) maxType = t;
        }

        const count = new Uint32Array(maxType + 1);

        for(let i = 0; i < n; i++){
            count[types[idx[i]]]++;
        }

        let sum = 0;
        for(let i = 0; i <= maxType; i++){
            const c = count[i];
            count[i] = sum + c;
            sum += c;
        }

        const tmp = new Uint32Array(n);
        for(let i = n - 1; i >= 0; i--){
            const index = idx[i];
            const t = types[index];
            const pos = --count[t];
            tmp[pos] = index;
        }

        idx.set(tmp);
    }

    public async toGLB(
        filePath: string,
        outputFilePath: string,
        extractTimestepInfo: Function,
        opts: CompressionOptions = {}
    ): Promise<void> {
        const mortonBits = Math.max(1, opts.maxMortonBitsPerAxis ?? 10);

        const { positions, types, min, max } = await this.parseToTypedArrays(
            filePath,
            extractTimestepInfo
        );

        const extent = {
            x: Math.max(1e-20, max[0] - min[0]),
            y: Math.max(1e-20, max[1] - min[1]),
            z: Math.max(1e-20, max[2] - min[2])
        };

        const n = positions.length / 3;
        const idx = new Uint32Array(n);
        for(let i = 0; i < n; i++){
            idx[i] = i;
        }

        let uniqueTypesCount = 0;
        {
            const seen = new Set<number>();
            for(let i = 0; i < n; i++){
                seen.add(types[i]);
            }
            uniqueTypesCount = seen.size;
        }

        const perTypePrimitives = opts.perTypePrimitives ?? (uniqueTypesCount <= 16);
        const mortonKeys = new Uint32Array(n);
        for(let i = 0; i < n; i++){
            const p = i * 3;
            const nx = (positions[p] - min[0]) / extent.x;
            const ny = (positions[p + 1] - min[1]) / extent.y;
            const nz = (positions[p + 2] - min[2]) / extent.z;
            mortonKeys[i] = encodeMorton(nx, ny, nz, mortonBits);
        }

        AtomisticExporter.radixSortByMorton(idx, mortonKeys);
        if(perTypePrimitives){
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

        for(let i = 0, p = 0; i < n; i++){
            const t = typesR[i];
            let rgb = colorCache.get(t);

            if(!rgb){
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

        await writeGLB(doc, outputFilePath);
    }

    public async exportAtomsTypeToGLB(
        atomsByType: AtomsGroupedByType,
        outputFilePath: string,
        opts: CompressionOptions = {}
    ): Promise<void> {
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
        for(const [typeName, atoms] of Object.entries(atomsByType)){
            const key = typeName.toUpperCase().replace(/ /g, '_');
            const rgbInts = this.STRUCTURE_COLORS[key] || this.STRUCTURE_COLORS['OTHER'];
            const rgb = [rgbInts[0] / 255, rgbInts[1] / 255, rgbInts[2] / 255];

            for(let i = 0; i < atoms.length; i++){
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

        await writeGLB(doc, outputFilePath);
    }
};