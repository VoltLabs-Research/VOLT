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

import { readFile } from 'fs/promises';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN  = 0x004e4942;

const COMPONENT_BYTES: Record<number, number> = {
    5120: 1,
    5121: 1,
    5122: 2,
    5123: 2,
    5125: 4,
    5126: 4
};

const TYPE_COMPONENTS: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16
};

export const readUTF8 = (buffer: Buffer, start: number, length: number): string => {
    return new TextDecoder('utf-8').decode(buffer.subarray(start, start + length));
}

export const readAccessor = (
    accIndex: number,
    accessors: any[],
    bufferViews: any[],
    binaryBase: number,
    buffer: ArrayBufferLike
): { array: ArrayLike<number>, componentCount: number, componentType: number } => {
    const acc = accessors[accIndex];
    if(!acc) throw new Error(`Accessor ${accIndex} not found`);
    const bufferView = bufferViews[acc.bufferView];
    if(!bufferView) throw new Error(`BufferView ${acc.bufferView} not found`);

    const componentCount = TYPE_COMPONENTS[acc.type];
    const componentBytes = COMPONENT_BYTES[acc.componentType];
    const tightStride = componentBytes * componentCount;
    const byteStride = bufferView.byteStride ?? tightStride;

    const start = binaryBase + (bufferView.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const count = acc.count;

    const ctor = (() => {
        switch(acc.componentType){
            case 5121: return Uint8Array;
            case 5123: return Uint16Array;
            case 5125: return Uint32Array;
            case 5126: return Float32Array;
            case 5120: return Int8Array;
            case 5122: return Int16Array;
            default: throw new Error(`Unsupported componentType ${acc.componentType}`);
        }
    })();

    if(byteStride === tightStride){
        const byteLength = count * tightStride;
        // @ts-ignore
        const array = new ctor(buffer, start, byteLength / ctor.BYTES_PER_ELEMENT);
        return { array, componentCount, componentType: acc.componentType };
    }

    const out =
        acc.componentType === 5126
            ? new Float32Array(count * componentCount)
            : new Uint32Array(count * componentCount);

    const view = new DataView(buffer, start, count * byteStride);
    let o = 0;
    for(let i = 0; i < count; i++){
        const base = i * byteStride;
        for(let k = 0; k < componentCount; k++){
            const offs = base + k * componentBytes;
            switch(acc.componentType){
                case 5126: out[o++] = view.getFloat32(offs, true); break;
                case 5125: out[o++] = view.getUint32(offs, true); break;
                case 5123: out[o++] = view.getUint16(offs, true); break;
                case 5121: out[o++] = view.getUint8(offs); break;
                case 5122: out[o++] = view.getInt16(offs, true); break;
                case 5120: out[o++] = view.getInt8(offs); break;
            }
        }
    }

    return { array: out, componentCount, componentType: acc.componentType };
};

export const parseGLB = async (inputFilePath: string, isMeshGLB: boolean = false): Promise<any> => {
    const file = await readFile(inputFilePath);
    const dataView = new DataView(file.buffer, file.byteOffset, file.byteLength);
    let offset = 0;

    const magic = dataView.getUint32(offset, true); offset += 4;
    if(magic !== GLB_MAGIC) throw new Error('Not a GLB file');
    const version = dataView.getUint32(offset, true); offset += 4;
    if(version !== 2) throw new Error('GLB version must be 2.0');
    const length = dataView.getUint32(offset, true); offset += 4;

    let gltf: any = null;
    let binStart = 0;

    while(offset < length){
        const chunkLength = dataView.getUint32(offset, true); offset += 4;
        const chunkType = dataView.getUint32(offset, true); offset += 4;
        if(chunkType === CHUNK_JSON){
            const start = file.byteOffset + offset;
            gltf = JSON.parse(readUTF8(file, start, chunkLength));
        }else if(chunkType === CHUNK_BIN){
            binStart = offset;
        }
        offset += chunkLength;
    }

    if(!gltf) throw new Error('Missing JSON chunk in GLB');

    const accessors = gltf.accessors ?? [];
    const bufferViews = gltf.bufferViews ?? [];
    const binBase = file.byteOffset + binStart;

    const hasInstancing = Array.isArray(gltf.nodes) && gltf.nodes.some((n: any) => n.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION !== undefined);
    if(!isMeshGLB && hasInstancing){
        const points: { index: number; position: [number, number, number] }[] = [];
        let idx = 0;
        for(const node of gltf.nodes){
            const ext = node.extensions?.EXT_mesh_gpu_instancing;
            if(!ext?.attributes?.TRANSLATION) continue;
            const tAcc = readAccessor(ext.attributes.TRANSLATION, accessors, bufferViews, binBase, file.buffer);
            if(tAcc.componentCount !== 3) continue;
            const arr = tAcc.array as any;
            for(let i = 0; i < arr.length; i += 3){
                points.push({ index: idx++, position: [Number(arr[i]), Number(arr[i+1]), Number(arr[i+2])] });
            }
        }
        return { data: { points, facets: [], metadata: gltf.extras ?? {} } };
    }

    if(!gltf?.meshes?.length) throw new Error('GLB contains no meshes');

    const positionsOut: [number, number, number][] = [];
    const facetsOut: { vertices: [number, number, number] }[] = [];
    let baseIndex = 0;

    for(const mesh of gltf.meshes){
        if(!mesh?.primitives?.length) continue;
        for(const primitive of mesh.primitives){
            if(primitive.attributes?.POSITION === undefined) continue;
            const posAcc = readAccessor(primitive.attributes.POSITION, accessors, bufferViews, binBase, file.buffer);
            if(posAcc.componentCount !== 3) continue;
            const posArr = posAcc.array as any;
            const startBase = baseIndex;
            for(let i = 0; i < posArr.length; i += 3){
                positionsOut.push([Number(posArr[i]), Number(posArr[i+1]), Number(posArr[i+2])]);
                baseIndex++;
            }

            if(primitive.indices !== undefined){
                const idxAcc = readAccessor(primitive.indices, accessors, bufferViews, binBase, file.buffer);
                if(idxAcc.componentCount !== 1) continue;
                const ia = idxAcc.array as any;
                for(let i = 0; i < ia.length; i += 3){
                    facetsOut.push({ vertices: [startBase + Number(ia[i]), startBase + Number(ia[i+1]), startBase + Number(ia[i+2])] });
                }
            }else{
                const mode = primitive.mode ?? 4;
                if(mode === 4){
                    for(let i = 0; i < (baseIndex - startBase); i += 3){
                        facetsOut.push({ vertices: [startBase + i, startBase + i + 1, startBase + i + 2] });
                    }
                }
            }
        }
    }

    const points = positionsOut.map((pos, index) => ({ index, position: pos }));
    return { data: { points, facets: facetsOut, metadata: gltf.extras ?? {} } };
};

// Removed assembleAndWriteGLB - use assembleGLBToBuffer instead

export const assembleGLBToBuffer = (glbJson: any, binaryBuffer: ArrayBuffer): Buffer => {
    const jsonString = JSON.stringify(glbJson);
    const jsonChunkLength = Buffer.byteLength(jsonString, 'utf8');
    const jsonPadding = (4 - (jsonChunkLength % 4)) % 4;
    const jsonTotalLength = jsonChunkLength + jsonPadding;
    const binaryChunkLength = binaryBuffer.byteLength;
    const binaryPadding = (4 - (binaryChunkLength % 4)) % 4;
    const binaryTotalLength = binaryChunkLength + binaryPadding;
    const headerLength = 12;
    const chunkHeaderLength = 8;
    const totalLength = headerLength + (chunkHeaderLength + jsonTotalLength) + (chunkHeaderLength + binaryTotalLength);
    const glbBuffer = new ArrayBuffer(totalLength);
    const dataView = new DataView(glbBuffer);
    let byteOffset = 0;

    dataView.setUint32(byteOffset, 0x46546C67, true); 
    byteOffset += 4;

    dataView.setUint32(byteOffset, 2, true); 
    byteOffset += 4;

    dataView.setUint32(byteOffset, totalLength, true); 
    byteOffset += 4;

    dataView.setUint32(byteOffset, jsonTotalLength, true); 
    byteOffset += 4;

    dataView.setUint32(byteOffset, 0x4E4F534A, true); 
    byteOffset += 4;

    const jsonUint8Array = new TextEncoder().encode(jsonString);
    new Uint8Array(glbBuffer, byteOffset).set(jsonUint8Array);
    byteOffset += jsonChunkLength;

    for(let i = 0; i < jsonPadding; i++){
        dataView.setUint8(byteOffset++, 0x20);
    }

    dataView.setUint32(byteOffset, binaryTotalLength, true); 
    byteOffset += 4;

    dataView.setUint32(byteOffset, 0x004E4942, true); 
    byteOffset += 4;

    new Uint8Array(glbBuffer, byteOffset).set(new Uint8Array(binaryBuffer));
    byteOffset += binaryChunkLength;

    return Buffer.from(glbBuffer);
};
