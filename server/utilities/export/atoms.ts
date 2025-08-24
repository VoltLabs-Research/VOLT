import { Document, NodeIO, Accessor } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { quantize as gtQuantize, meshopt as gtMeshopt, draco as gtDraco } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

import { AtomsGroupedByType } from '@/types/utilities/export/atoms';
import { readLargeFile } from '@/utilities/fs';
import { assembleAndWriteGLB } from '@/utilities/export/utils';

export type CompressionOptions = {
    quantization?: {
        positionBits?: number;
        colorBits?: number;
    };
    perTypePrimitives?: boolean;
    epsilon?: number;
    maxMortonBitsPerAxis?: number;
    meshopt?: Boolean;
    requireExtensions?: Boolean;
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
        'CUBIC_DIAMOND': [19, 160, 254],
        'CUBIC_DIAMOND_FIRST_NEIGH': [0, 254, 245],
        'CUBIC_DIAMOND_SECOND_NEIGH': [126, 254, 181],
        'HEX_DIAMOND_FIRST_NEIGH': [254, 220, 0],
        'HEX_DIAMOND_SECOND_NEIGH': [204, 229, 81],
        'HEX_DIAMOND': [254, 137, 0],
        'OTHER': [242, 242, 242]
    };

    private static calculateBoundsFromPositions(positions: Float32Array){
        let minX = Infinity,  maxX = -Infinity;
        let minY = Infinity,  maxY = -Infinity;
        let minZ = Infinity,  maxZ = -Infinity;

        for(let i = 0; i < positions.length; i += 3){
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];

            if(x < minX) minX = x;
            if(x > maxX) maxX = x;

            if(y < minY) minY = y;
            if(y > maxY) maxY = y;

            if(z < minZ) minZ = z;
            if(z > maxZ) maxZ = z;
        }
    
        return { 
            min: { x: minX, y: minY, z: minZ }, 
            max: { x: maxX, y: maxY, z: maxZ} 
        };
    }

    private static encodeMorton10(nx: number, ny: number, nz: number, bits = 10): number{
        const maxv = (1 << bits) - 1;
        let xi = Math.max(0, Math.min(maxv, (nx * maxv) | 0));
        let yi = Math.max(0, Math.min(maxv, (ny * maxv) | 0));
        let zi = Math.max(0, Math.min(maxv, (nz * maxv) | 0));

        const splitBy3 = (v: number) => {
            v = (v | (v << 16)) & 0x030000FF;
            v = (v | (v << 8))  & 0x0300F00F;
            v = (v | (v << 4))  & 0x030C30C3;
            v = (v | (v << 2))  & 0x09249249;
            return v >>> 0;
        };

        const xx = splitBy3(xi);
        const yy = splitBy3(yi);
        const zz = splitBy3(zi);
        return (xx | (yy << 1) | (zz << 2)) >>> 0;
    }

    private async parseToTypedArrays(
        filePath: string,
        extractTimestepInfo: Function
    ): Promise<{ timestepInfo: any; positions: Float32Array; types: Uint16Array }>{
        let inAtoms = false; 
        let count = 0; 
        let gotTimestep = false; 
        let header = '';
    
        const headLines: string[] = [];

        await readLargeFile(filePath, {
            maxLines: 1000,
            onLine: (line: string) => {
                const t = line.trim();
                
                if(!gotTimestep && t.includes('TIMESTEP')){
                    gotTimestep = true;
                }
                
                if(t.startsWith('ITEM: ATOMS')){
                    header = t; 
                    inAtoms = true; 
                    return; 
                }

                if(t.startsWith('ITEM:') && inAtoms){
                    inAtoms = false;
                    return;
                }

                if(inAtoms && t){
                    const parts = t.split(/\s+/);
                    if(parts.length >= 5){
                        count++;
                    }
                }

                if(headLines.length < 1000){
                    headLines.push(line);
                }
            }
        });

        const timestepInfo = extractTimestepInfo(headLines);
        if(!timestepInfo) throw new Error('Can not extract TIMESTEP');
        if(count === 0) throw new Error('No atoms found');

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

                if(inAtoms2 && t) {
                    const p = t.split(/\s+/);
                    if(p.length >= 5){
                        const type = parseInt(p[1]);
                        types[i] = type;
                        const base = i * 3;
                        positions[base]   = parseFloat(p[2]);
                        positions[base+1] = parseFloat(p[3]);
                        positions[base+2] = parseFloat(p[4]);
                        i++;
                    }
                }
            }
        });

        return { timestepInfo, positions, types }
    }

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
        outputFilePath: string
    ): Promise<void>{
        const bounds = AtomisticExporter.calculateBoundsFromPositions(positions);
        const scale = {
            x: Math.max(1e-20, bounds.max.x - bounds.min.x),
            y: Math.max(1e-20, bounds.max.y - bounds.min.y),
            z: Math.max(1e-20, bounds.max.z - bounds.min.z)
        };

        const qPos = new Uint16Array(positions.length);
        for(let i = 0; i < positions.length; i += 3){
            const nx = (positions[i]   - bounds.min.x) / scale.x;
            const ny = (positions[i + 1] - bounds.min.y) / scale.y;
            const nz = (positions[i + 2] - bounds.min.z) / scale.z;

            qPos[i] = Math.min(65535, Math.max(0, Math.round(nx * 65535)));
            qPos[i + 1] = Math.min(65535, Math.max(0, Math.round(ny * 65535)));
            qPos[i + 2] = Math.min(65535, Math.max(0, Math.round(nz * 65535)));
        }
 
        let qCol: Uint8Array | undefined;
        if(colors){
            qCol = new Uint8Array(colors.length);
            for(let i = 0; i < colors.length; i++){
                qCol[i] = Math.min(255, Math.max(0, Math.round(colors[i] * 255)));
            }
        }

        const glb: any = {
            asset: {
                version: '2.0', 
                generator: 'OpenDXA Atomistic Exporter' 
            },
            extensionsUsed: ['KHR_mesh_quantization'],
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ 
                mesh: 0, 
                translation: [bounds.min.x, bounds.min.y, bounds.min.z], 
                scale: [scale.x, scale.y, scale.z] 
            }],
            meshes: [{
                primitives: [{
                    attributes: { POSITION: 0, ...(qCol? { COLOR_0: 1 }: {}) }, 
                    material: 0, 
                    mode: 0 
                }]
            }],
            materials: [{
                name: 'PointCloudMaterial', 
                pbrMetallicRoughness: { baseColorFactor: [1,1,1,1] } 
            }],
            accessors: [{
                bufferView: 0, 
                componentType: 5123, 
                count: qPos.length / 3, 
                type: 'VEC3', 
                normalized: true 
            }],
            bufferViews: [{
                buffer: 0,
                byteOffset: 0,
                byteLength: qPos.byteLength,
                target: 34962
            }],
            buffers: [{ byteLength: 0 }]
        };

        if(qCol){
            glb.accessors.push({
                bufferView: 1, 
                componentType: 5121, 
                count: qCol.length / 3, 
                type: 'VEC3', 
                normalized: true 
            });

            glb.bufferViews.push({ 
                buffer: 0, 
                byteOffset: 0, 
                byteLength: qCol.byteLength, 
                target: 34962 
            });
        }

        const chunks = qCol ? [qPos.buffer, qCol.buffer].map((b) => ({ data: b })) : [{ data: qPos.buffer }];
        
        let offset = 0; 
        const offsets: number[] = [];

        for(const ch of chunks){
            offsets.push(offset); 
            offset = (offset + ch.data.byteLength + 3) & ~3; 
        }

        const bin = new Uint8Array(offset);
        for(let idx = 0, cur = 0; idx < chunks.length; idx++){
            const arr = new Uint8Array(chunks[idx].data); 
            cur = offsets[idx]; 
            bin.set(arr, cur);
            if(idx < glb.bufferViews.length){
                glb.bufferViews[idx].byteOffset = cur;
            }
        }
        glb.buffers[0].byteLength = bin.byteLength;

        assembleAndWriteGLB(glb, bin.buffer, outputFilePath);
    }

    public async exportAtomsToGLB(
        filePath: string,
        outputFilePath: string,
        extractTimestepInfo: Function,
        opts: CompressionOptions = {}
    ): Promise<void>{
        const mortonBits = opts.maxMortonBitsPerAxis ?? 10;
        const { positions, types } = await this.parseToTypedArrays(filePath, extractTimestepInfo);

        const bounds = AtomisticExporter.calculateBoundsFromPositions(positions);
        const extent = {
            x: Math.max(1e-20, bounds.max.x - bounds.min.x),
            y: Math.max(1e-20, bounds.max.y - bounds.min.y),
            z: Math.max(1e-20, bounds.max.z - bounds.min.z)
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
            const p = i*3;
            const nx = (positions[p]   - bounds.min.x) / extent.x;
            const ny = (positions[p + 1] - bounds.min.y) / extent.y;
            const nz = (positions[p + 2] - bounds.min.z) / extent.z;
            mortonKeys[i] = AtomisticExporter.encodeMorton10(nx, ny, nz, mortonBits);
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
        const mesh = doc.createMesh('Atoms');

        const ranges = [];
        let start = 0; 
        let currentType = typesR![0];

        for(let i = 1; i < n; i++){
            if(typesR![i] !== currentType){
                ranges.push({
                    type: currentType, 
                    start, 
                    count: i - start, 
                    color: this.lammpsTypeColors.get(currentType)
                });

                start = i;
                currentType = typesR![i];
            }
        }

        ranges.push({
            type: currentType, 
            start, 
            count: n - start, 
            color: this.lammpsTypeColors.get(currentType)
        });

        const posAcc = doc.createAccessor('POSITION')
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

        const colAcc = doc.createAccessor('COLOR_0')
            .setArray(colors)
            .setType(Accessor.Type.VEC3)
            .setBuffer(buffer);

        const prim = doc.createPrimitive()
            .setAttribute('POSITION', posAcc)
            .setAttribute('COLOR_0', colAcc)
            .setMode(0);

        mesh.addPrimitive(prim);
        doc.createMaterial('PointMat');
        const node = doc.createNode('Frame').setMesh(mesh);
        doc.createScene('Scene').addChild(node);

        let qPos = opts.quantization?.positionBits ?? 15;
        const qCol = opts.quantization?.colorBits ?? 8;

        if(opts.epsilon && isFinite(opts.epsilon) && opts.epsilon > 0){
            const e = opts.epsilon;
            const bitsX = Math.ceil(Math.log2(extent.x / (2 * e) + 1));
            const bitsY = Math.ceil(Math.log2(extent.y / (2 * e) + 1));
            const bitsZ = Math.ceil(Math.log2(extent.z / (2 * e) + 1));

            qPos = Math.max(8, Math.min(16, Math.max(bitsX, bitsY, bitsZ)));
        }

        await doc.transform(gtQuantize({ quantizePosition: qPos, quantizeColor: qCol }));

        await MeshoptEncoder.ready;
        doc.createExtension(EXTMeshoptCompression).setRequired(Boolean(opts.requireExtensions));
        await doc.transform(gtMeshopt({ encoder: MeshoptEncoder }));

        const io = new NodeIO()
            .registerExtensions([EXTMeshoptCompression])
            .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

        await io.write(outputFilePath, doc);
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

        const qPos = opts.quantization?.positionBits ?? 15;
        const qCol = opts.quantization?.colorBits    ?? 8;
        await doc.transform(gtQuantize({ quantizePosition: qPos, quantizeColor: qCol }));

        await MeshoptEncoder.ready;
        doc.createExtension(EXTMeshoptCompression).setRequired(Boolean(opts.requireExtensions));
        await doc.transform(gtMeshopt({ encoder: MeshoptEncoder }));

        const io = new NodeIO()
            .registerExtensions([EXTMeshoptCompression])
            .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

        await io.write(outputFilePath, doc);
    }
};

export default AtomisticExporter;