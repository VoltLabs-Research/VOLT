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

export type PrimitiveMaterial = {
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
    doubleSided?: boolean;
    name?: string;
}

export type BuildGLBParams = {
    positions: Float32Array;
    normals?: Float32Array;
    // VEC4
    colors?: Float32Array;
    indices?: Uint16Array | Uint32Array;
    // 0=POINTS, 4=TRIANGLES (4 default)
    mode?: number;
    nodeName?: string;
    meshName?: string;
    generator?: string;
    copyright?: string;
    material: PrimitiveMaterial;
    extras?: any;
}

export const buildPrimitiveGLB = ({
    positions,
    normals,
    colors,
    indices,
    mode = 4,
    nodeName = "Node",
    meshName = "MeshGeometry",
    generator = "OpenDXA GLB Builder",
    copyright,
    material,
    extras
}: BuildGLBParams): { glb: any, arrayBuffer: ArrayBuffer } => {
    const vertexCount = positions.length / 3;

    const posSize = positions.byteLength;
    const normSize = normals ? normals.byteLength : 0;
    const colSize = colors ? colors.byteLength : 0;
    const idxSize = indices ? indices.byteLength : 0;

    const posOffset = 0;
    const normOffset = posOffset + posSize;
    const colOffset = normOffset + normSize;
    const idxOffset = colOffset + colSize;
    const totalSize = idxOffset + idxSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    new Float32Array(arrayBuffer, posOffset, positions.length).set(positions);

    if(normals){
        new Float32Array(arrayBuffer, normOffset, normals.length).set(normals);
    }

    if(colors){
        new Float32Array(arrayBuffer, colOffset, colors.length).set(colors);
    }

    if(indices){
        if(indices instanceof Uint16Array){
            new Uint16Array(arrayBuffer, idxOffset, indices.length).set(indices);
        }else{
            new Uint32Array(arrayBuffer, idxOffset, indices.length).set(indices);
        }
    }

    const glb: any = {
        asset: {
        version: "2.0",
        generator,
        ...(copyright ? { copyright } : {})
        },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: nodeName, mesh: 0 }],
        materials: [{
        name: material.name ?? "Material",
        pbrMetallicRoughness: {
            baseColorFactor: material.baseColor,
            metallicFactor: material.metallic,
            roughnessFactor: material.roughness
        },
        emissiveFactor: material.emissive,
        doubleSided: Boolean(material.doubleSided)
        }],
        meshes: [],
        accessors: [],
        bufferViews: [],
        buffers: [{ byteLength: totalSize }],
        ...(extras ? { extras } : {})
    };

    // BufferViews
    const bvPos = glb.bufferViews.length;
    // ARRAY_BUFFER
    glb.bufferViews.push({ buffer: 0, byteOffset: posOffset, byteLength: posSize, target: 34962 });

    const accPos = glb.accessors.length;
    glb.accessors.push({ bufferView: bvPos, componentType: 5126, count: vertexCount, type: "VEC3" });

    let accNorm: number | undefined;
    if(normals){
        const bvNorm = glb.bufferViews.length;
        glb.bufferViews.push({ buffer: 0, byteOffset: normOffset, byteLength: normSize, target: 34962 });
        accNorm = glb.accessors.length;
        glb.accessors.push({ bufferView: bvNorm, componentType: 5126, count: vertexCount, type: "VEC3" });
    }
    
    let accCol: number | undefined;
    if(colors){
        const bvCol = glb.bufferViews.length;
        glb.bufferViews.push({ buffer: 0, byteOffset: colOffset, byteLength: colSize, target: 34962 });
        accCol = glb.accessors.length;
        glb.accessors.push({ bufferView: bvCol, componentType: 5126, count: vertexCount, type: "VEC4" });
    }

    let accIdx: number | undefined;
    let indexComponentType: 5123 | 5125 | undefined = undefined;
    if(indices && indices.length){
        // ELEMENT_ARRAY_BUFFER
        const bvIdx = glb.bufferViews.length;
        glb.bufferViews.push({ buffer: 0, byteOffset: idxOffset, byteLength: idxSize, target: 34963 });
        accIdx = glb.accessors.length;

        // UNSIGNED_SHORT / UNSIGNED_INT
        indexComponentType = indices instanceof Uint16Array ? 5123 : 5125;
        glb.accessors.push({ bufferView: bvIdx, componentType: indexComponentType, count: indices.length, type: "SCALAR" });
    }

    const attributes: Record<string, number> = { POSITION: accPos };
    if(accNorm !== undefined){
        attributes.NORMAL = accNorm;
    }

    if(accCol !== undefined){
        attributes.COLOR_0 = accCol;
    }

    glb.meshes.push({
        name: meshName,
        primitives: [{
        attributes,
        ...(accIdx !== undefined ? { indices: accIdx } : {}),
        material: 0,
        mode // 0 POINTS, 4 TRIANGLES
        }]
    });

    return { glb, arrayBuffer };
}