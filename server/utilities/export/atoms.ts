import { Document, Accessor } from '@gltf-transform/core';
import { AtomsGroupedByType } from '@/types/utilities/export/atoms';
import { readLargeFile } from '@/utilities/fs';
import { applyQuantizeAndMeshopt, writeGLB } from '@/utilities/export/gltf-pipeline';
import { computeBoundsFromFlat } from '@/utilities/export/bounds';
import encodeMorton from '@/utilities/export/morton';

export type CompressionOptions = {
    quantization?: {
        positionBits?: number;
        colorBits?: number;
    };
    perTypePrimitives?: boolean;
    epsilon?: number;
    maxMortonBitsPerAxis?: number;
    meshopt?: Boolean;
}

class AtomisticExporter{
    private lammpsTypeColors: Map<number, number[]> = new Map([
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
    ): Promise<{ timestepInfo: any; positions: Float32Array; types: Uint16Array }>{
        let inAtoms = false;
        let count = 0;
        let headerCols: string[] = [];

        const headLines: string[] = [];

        await readLargeFile(filePath, {
            onLine: (line: string) => {
                const t = line.trim();
                if(t.startsWith('ITEM: ATOMS')){
                    headerCols = t.replace(/^ITEM:\s*ATOMS\s*/,'').trim().split(/\s+/);
                    inAtoms = true;
                    return;
                }

                if(t.startsWith('ITEM:') && inAtoms){
                    inAtoms = false;
                    return;
                }

                if(inAtoms && t){
                    const parts = t.split(/\s+/);
                    if(parts.length >= headerCols.length) count++;
                }

                if(headLines.length < 1000) headLines.push(line);
            }
        });

        const timestepInfo = extractTimestepInfo(headLines);
        if(!timestepInfo) throw new Error('Can not extract TIMESTEP');
        if(count === 0) throw new Error('No atoms found');

        const colIndex = (name: string) => headerCols.findIndex((c) => c.toLowerCase() === name);
        const idxType = ['type'].map(colIndex).find(i => i >= 0) ?? -1;
        const idxX = ['x','xu','xs','xsu'].map(colIndex).find(i => i >= 0) ?? -1;
        const idxY = ['y','yu','ys','ysu'].map(colIndex).find(i => i >= 0) ?? -1;
        const idxZ = ['z','zu','zs','zsu'].map(colIndex).find(i => i >= 0) ?? -1;
        if(idxType < 0 || idxX < 0 || idxY < 0 || idxZ < 0){
            throw new Error(`Unsupported ATOMS columns: ${headerCols.join(' ')}`);
        }

        const positions = new Float32Array(count * 3);
        const types = new Uint16Array(count);

        let inAtoms2 = false;
        let i = 0;
        await readLargeFile(filePath, {
            onLine: (line: string) => {
                const t = line.trim();
                if(t.startsWith('ITEM: ATOMS')){
                    inAtoms2 = true;
                    return;
                }
                if(t.startsWith('ITEM:') && inAtoms2){
                    inAtoms2 = false;
                    return;
                }
                if(inAtoms2 && t){
                    const p = t.split(/\s+/);
                    if(p.length >= headerCols.length){
                        const base = i * 3;
                        types[i] = p[idxType] ? parseInt(p[idxType], 10) : 0;
                        positions[base] = parseFloat(p[idxX]);
                        positions[base+1] = parseFloat(p[idxY]);
                        positions[base+2] = parseFloat(p[idxZ]);
                        i++;
                        if(i >= count) inAtoms2 = false;
                    }
                }
            }
        });

        return { timestepInfo, positions, types };
    };

    private static reorderByOrder(order: Uint32Array, positions: Float32Array, types?: Uint16Array, colors?: Float32Array){
        const n = order.length;
        const pos2 = new Float32Array(n * 3);

        for(let i = 0, p = 0; i < n; i++){
            const src = order[i] * 3;
            pos2[p++] = positions[src];
            pos2[p++] = positions[src+1];
            pos2[p++] = positions[src+2];
        }

        let types2: Uint16Array | undefined;
        if(types){
            types2 = new Uint16Array(n);
            for(let i=0; i<n; i++){
                types2[i] = types[order[i]];
            }
        }

        let colors2: Float32Array | undefined;
        if(colors){
            colors2 = new Float32Array(n * 3);
            for(let i=0, p=0; i<n; i++){
                const src = order[i] * 3;
                colors2[p++] = colors[src];
                colors2[p++] = colors[src+1];
                colors2[p++] = colors[src+2];
            }
        }

        return { positions: pos2, types: types2, colors: colors2 };
    }

    public async exportAtomsToPointCloudGLB(
        positions: Float32Array,
        colors: Float32Array | undefined,
        outputFilePath: string,
        opts: CompressionOptions = {}
    ): Promise<void>{
        const { min, max } = computeBoundsFromFlat(positions);
        const extent = {
            x: Math.max(1e-20, max[0] - min[0]),
            y: Math.max(1e-20, max[1] - min[1]),
            z: Math.max(1e-20, max[2] - min[2]),
        };

        const doc = new Document();
        const buffer = doc.createBuffer('bin');

        const positionAcc = doc.createAccessor('POSITION')
            .setArray(positions)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        let colorAcc: any;
        if(colors){
            colorAcc = doc.createAccessor('COLOR_0')
                .setArray(colors)
                .setType(Accessor.Type.VEC3)
                .setBuffer(buffer);
        }

        const primitive = doc.createPrimitive()
            .setAttribute('POSITION', positionAcc)
            // POINTS
            .setMode(0);
        
        if(colorAcc){
            primitive.setAttribute('COLOR_0', colorAcc);
        }

        const mesh = doc.createMesh('AtomsPoints').addPrimitive(primitive);
        const node = doc.createNode('Frame').setMesh(mesh);

        doc.createScene('Scene').addChild(node);
        doc.createMaterial('PointMat');

        await applyQuantizeAndMeshopt(doc, {
            quantization: {
                positionBits: opts.quantization?.positionBits ?? 15,
                colorBits: opts.quantization?.colorBits ?? 8,
            },
            epsilon: opts.epsilon,
            requireExtensions: true
        }, extent);

        await writeGLB(doc, outputFilePath);
    }

    public async exportAtomsToGLB(
        filePath: string,
        outputFilePath: string,
        extractTimestepInfo: Function,
        opts: CompressionOptions = {}
    ): Promise<void>{
        const mortonBits = opts.maxMortonBitsPerAxis ?? 10;
        const { positions, types } = await this.parseToTypedArrays(filePath, extractTimestepInfo);

        const { min, max } = computeBoundsFromFlat(positions);
        const extent = {
            x: Math.max(1e-20, max[0] - min[0]),
            y: Math.max(1e-20, max[1] - min[1]),
            z: Math.max(1e-20, max[2] - min[2]),
        };

        const n = positions.length / 3;
        const idx = new Uint32Array(n);
        for(let i=0; i<n; i++){
            idx[i] = i;
        }

        let uniqueTypesCount = 0;
        {
            const seen = new Set<number>();
            for(let i=0; i<n; i++){
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

        idx.sort((a, b) => {
            if(perTypePrimitives){
                const ta = types[a];
                const tb = types[b]; 
                
                if (ta !== tb) return ta - tb;
            }

            return (mortonKeys[a]) - (mortonKeys[b]);
        });

        const { positions: posR, types: typesR } = AtomisticExporter.reorderByOrder(idx, positions, types);

        const doc = new Document();
        const buffer = doc.createBuffer('bin');
        
        const positionAcc = doc.createAccessor('POSITION')
            .setArray(posR)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const colors = new Float32Array(n * 3);
        for(let i = 0, p = 0; i < n; i++){
            const t = typesR![i];
            const c = this.lammpsTypeColors.get(t) || [0.6, 0.6, 0.6, 1];
            colors[p++] = c[0];
            colors[p++] = c[1];
            colors[p++] = c[2];
        }

        const colorAcc = doc.createAccessor('COLOR_0')
            .setArray(colors)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const primitive = doc.createPrimitive()
            .setAttribute('POSITION', positionAcc)
            .setAttribute('COLOR_0', colorAcc)
            .setMode(0);

        const mesh = doc.createMesh('Atoms').addPrimitive(primitive);
        doc.createMaterial('PointMat');
        
        const node = doc.createNode('Frame').setMesh(mesh);
        doc.createScene('Scene').addChild(node);

        await applyQuantizeAndMeshopt(doc, {
            quantization: {
                positionBits: opts.quantization?.positionBits ?? 15,
                colorBits: opts.quantization?.colorBits ?? 8,
            },
            epsilon: opts.epsilon,
            requireExtensions: true
        }, extent);

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

        let cursor = 0;
        for(const [typeName, atoms] of Object.entries(atomsByType)){
            const key = typeName.toUpperCase().replace(/ /g, '_');
            const rgb = (this.STRUCTURE_COLORS[key] || this.STRUCTURE_COLORS['OTHER']).map(v => v / 255);

            for(let i = 0; i < atoms.length; i++){
                const p = (cursor + i) * 3;
                const a = atoms[i];
                positions[p] = a.pos[0];
                positions[p + 1] = a.pos[1];
                positions[p + 2] = a.pos[2];

                colors[p] = rgb[0];
                colors[p + 1] = rgb[1];
                colors[p + 2] = rgb[2];
            }

            cursor += atoms.length;
        }

        const { min, max } = computeBoundsFromFlat(positions);
        const extent = {
            x: Math.max(1e-20, max[0] - min[0]),
            y: Math.max(1e-20, max[1] - min[1]),
            z: Math.max(1e-20, max[2] - min[2])
        };

        const doc = new Document();
        const buffer = doc.createBuffer('bin');

        const posAcc = doc.createAccessor('POSITION')
            .setArray(positions)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const colAcc = doc.createAccessor('COLOR_0')
            .setArray(colors) 
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const prim = doc.createPrimitive()
            .setAttribute('POSITION', posAcc)
            .setAttribute('COLOR_0', colAcc)
            .setMode(0);

        const mesh = doc.createMesh('AtomsByType').addPrimitive(prim);
        const node = doc.createNode('Frame').setMesh(mesh);
        doc.createScene('Scene').addChild(node);

        doc.createMaterial('PointMat');
        await applyQuantizeAndMeshopt(doc, {
            quantization: {
                positionBits: opts.quantization?.positionBits ?? 15,
                colorBits: opts.quantization?.colorBits ?? 8,
            },
            epsilon: opts.epsilon,
            requireExtensions: true
        }, extent);

        await writeGLB(doc, outputFilePath);
    }
};

export default AtomisticExporter;