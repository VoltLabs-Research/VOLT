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

import * as fs from 'fs';

export interface Mesh{
    data: {
        points: {
            index: number;
            position: [number, number, number];
        }[];
        facets: {
            vertices: [number, number, number];
        }[];
        metadata: any;
    }
}

export interface DefectMeshExportOptions{
    generateNormals?: boolean;
    enableDoubleSided?: boolean;
    smoothIterations?: number;
    material?: {
        baseColor?: [number, number, number, number];
        metallic?: number;
        roughness?: number;
        emissive?: [number, number, number];
    };
    metadata?: {
        includeOriginalStats?: boolean;
        customProperties?: Record<string, any>;
    };
}

interface MeshValidationResult{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    stats: object;
}

interface ProcessedMesh{
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    vertexCount: number;
    triangleCount: number;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

class MeshExporter{
    private validate(mesh: Mesh): MeshValidationResult{
        const { points, facets } = mesh.data;
        const errors: string[] = [];
        const warnings: string[] = [];

        if(!points || points.length === 0){
            errors.push('No points were found in the mesh.');
        }

        if(!facets || facets.length === 0){
            warnings.push('No facets were found in the mesh. A file with no visible geometry will be generated.');
        }

        const maxPointIndex = points.length - 1;
        let degenerateTriangles = 0;

        for(let i = 0; i < facets.length; i++){
            const facet = facets[i];
            if(facet.vertices.some((idx) => idx < 0 || idx > maxPointIndex)){
                errors.push(`Facet ${i} has vertex indices out of range.`);
                continue;
            }
            const [v0, v1, v2] = facet.vertices;
            if(v0 === v1 || v1 === v2 || v0 === v2){
                degenerateTriangles++;
            }
        }
        
        if(degenerateTriangles > 0){
            warnings.push(`Found ${degenerateTriangles} degenerate triangles.`);
        }

        return { isValid: errors.length === 0, errors, warnings, stats: {} };
    }

    private calculateMinBounds(position: [number, number, number][]): [number, number, number]{
        if(position.length === 0) return [0, 0, 0];
        return position.reduce((min, p) => [
            Math.min(min[0], p[0]),
            Math.min(min[1], p[1]),
            Math.min(min[2], p[2]),
        ], [Infinity, Infinity, Infinity]);
    }
    
    private calculateMaxBounds(positions: [number, number, number][]): [number, number, number]{
        if(positions.length === 0) return [0, 0, 0];
        return positions.reduce((max, p) => [
            Math.max(max[0], p[0]),
            Math.max(max[1], p[1]),
            Math.max(max[2], p[2]),
        ], [-Infinity, -Infinity, -Infinity]);
    }

    public toGLTF(
        mesh: Mesh,
        outputFilePath: string,
        options: DefectMeshExportOptions = {}
    ): void{
        const opts: Required<DefectMeshExportOptions> = {
            generateNormals: options.generateNormals ?? true,
            enableDoubleSided: options.enableDoubleSided ?? true,
            smoothIterations: options.smoothIterations ?? 0, 
            material: {
                baseColor: options.material?.baseColor ?? [0.0, 0.8, 1.0, 1.0],
                metallic: options.material?.metallic ?? 0.1,
                roughness: options.material?.roughness ?? 0.5,
                emissive: options.material?.emissive ?? [0.0, 0.0, 0.0],
            },
            metadata: {
                includeOriginalStats: options.metadata?.includeOriginalStats ?? true,
                customProperties: options.metadata?.customProperties ?? {},
            }
        };

        console.log('Starting mesh export...');

        const validation = this.validate(mesh);
        if(!validation.isValid){
            console.error('Validation failed:', validation.errors);
            throw new Error(`Invalid defect mesh: ${validation.errors.join(', ')}`);
        }

        if(validation.warnings.length > 0){
            console.warn('Validation warnings:', validation.warnings);
        }

        const processedMesh = this.processMeshGeometry(mesh, opts);
        const gltf = this.createMeshGLTF(processedMesh, opts);

        fs.writeFileSync(outputFilePath, JSON.stringify(gltf, null, 2));

        console.log(`Mesh successfully exported to: ${outputFilePath}`);
        console.log(`Final statistics: ${processedMesh.triangleCount} triangles, ${processedMesh.vertexCount} vertices.`);

        const bufferSizeMB = (gltf.buffers[0].byteLength / (1024 * 1024)).toFixed(2);
        console.log(`Buffer size: ${bufferSizeMB} MB`);
    }

    private processMeshGeometry(mesh: Mesh, options: Required<DefectMeshExportOptions>): ProcessedMesh{
        const { points, facets } = mesh.data;
        const vertexCount = points.length;
        const triangleCount = facets.length;
        
        console.log(`Processing mesh: ${triangleCount} triangles, ${vertexCount} vertices.`);

        const positionsData = points.flatMap((p) => p.position);
        const positions = new Float32Array(positionsData);

        const indicesData = facets.flatMap((f) => f.vertices);
        const indices = new Uint32Array(indicesData);

        if(options.smoothIterations){
            this.smoothMesh(positions, indices, options.smoothIterations);
        }

        const normals = new Float32Array(vertexCount * 3);

        for(let i = 0; i < indices.length; i += 3){
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            const p0_idx = i0 * 3;
            const p1_idx = i1 * 3;
            const p2_idx = i2 * 3;
            
            const p0 = [positions[p0_idx], positions[p0_idx + 1], positions[p0_idx + 2]];
            const p1 = [positions[p1_idx], positions[p1_idx + 1], positions[p1_idx + 2]];
            const p2 = [positions[p2_idx], positions[p2_idx + 1], positions[p2_idx + 2]];

            const edge1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const edge2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

            const faceNormal = [
                edge1[1] * edge2[2] - edge1[2] * edge2[1],
                edge1[2] * edge2[0] - edge1[0] * edge2[2],
                edge1[0] * edge2[1] - edge1[1] * edge2[0]
            ];

            normals[p0_idx] += faceNormal[0]; 
            normals[p0_idx + 1] += faceNormal[1]; 
            normals[p0_idx + 2] += faceNormal[2];
            
            normals[p1_idx] += faceNormal[0]; 
            normals[p1_idx + 1] += faceNormal[1]; 
            normals[p1_idx + 2] += faceNormal[2];
            
            normals[p2_idx] += faceNormal[0]; 
            normals[p2_idx + 1] += faceNormal[1]; 
            normals[p2_idx + 2] += faceNormal[2];
        }

        for(let i = 0; i < normals.length; i += 3){
            const nx = normals[i];
            const ny = normals[i + 1];
            const nz = normals[i + 2];
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

            if(len > 1e-6){
                normals[i] /= len;
                normals[i + 1] /= len;
                normals[i + 2] /= len;
            }else{
                // If length is zero (isolated vertex), assign a default normal to comply with the glTF specification.
                normals[i] = 0;
                normals[i + 1] = 0;
                normals[i + 2] = 1;
            }
        }

        const bounds = {
            min: this.calculateMinBounds(points.map((p) => p.position)),
            max: this.calculateMaxBounds(points.map((p) => p.position))
        };

        return { positions, normals, indices, vertexCount, triangleCount, bounds };
    }

    private createMeshGLTF(mesh: ProcessedMesh, options: Required<DefectMeshExportOptions>): any{
        const positionBufferSize = mesh.positions.byteLength;
        const normalBufferSize = mesh.normals.byteLength;
        const indexBufferSize = mesh.indices.byteLength;

        const positionOffset = 0;
        const normalOffset = positionBufferSize;
        const indexOffset = normalOffset + normalBufferSize;
        const totalBufferSize = indexOffset + indexBufferSize;

        const arrayBuffer = new ArrayBuffer(totalBufferSize);
        
        new Float32Array(arrayBuffer, positionOffset, mesh.positions.length).set(mesh.positions);
        new Float32Array(arrayBuffer, normalOffset, mesh.normals.length).set(mesh.normals);

        if(mesh.indices.length > 0){
            new Uint32Array(arrayBuffer, indexOffset, mesh.indices.length).set(mesh.indices);
        }

        const gltf: any = {
            asset: {
                version: '2.0',
                generator: 'OpenDXA Mesh Exporter',
                copyright: 'https://github.com/rodyherrera/OpenDXA'
            },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ name: 'Mesh', mesh: 0 }],
            materials: [{
                name: 'Mesh',
                pbrMetallicRoughness: {
                    baseColorFactor: options.material.baseColor,
                    metallicFactor: options.material.metallic,
                    roughnessFactor: options.material.roughness,
                },
                emissiveFactor: options.material.emissive,
                doubleSided: options.enableDoubleSided
            }],
            meshes: [],
            accessors: [
                // POSITION
                { bufferView: 0, componentType: 5126, count: mesh.vertexCount, type: 'VEC3', min: mesh.bounds.min, max: mesh.bounds.max },
                // NORMAL
                { bufferView: 1, componentType: 5126, count: mesh.vertexCount, type: 'VEC3' },
            ],
            bufferViews: [
                // ARRAY_BUFFER (Positions)
                { buffer: 0, byteOffset: positionOffset, byteLength: positionBufferSize, target: 34962 },
                // ARRAY_BUFFER (Normals)
                { buffer: 0, byteOffset: normalOffset, byteLength: normalBufferSize, target: 34962 },
            ],
            buffers: [{
                byteLength: totalBufferSize,
                uri: `data:application/octet-stream;base64,${this.arrayToBase64(arrayBuffer)}`
            }],
            extras: options.metadata.includeOriginalStats ? {
                stats: {
                    vertexCount: mesh.vertexCount,
                    triangleCount: mesh.triangleCount,
                },
                ...options.metadata.customProperties,
            } : options.metadata.customProperties
        };

        // Only add the mesh primitive if there are triangles to render
        if(mesh.indices.length > 0){
            gltf.meshes.push({
                name: 'MeshGeometry',
                primitives: [{
                    attributes: { POSITION: 0, NORMAL: 1 },
                    // Points to the index accessor
                    indices: 2, 
                    material: 0,
                    // 4 = TRIANGLES
                    mode: 4,
                }]
            });

            gltf.accessors.push({ bufferView: 2, componentType: 5125, count: mesh.indices.length, type: 'SCALAR' });
            gltf.bufferViews.push({ buffer: 0, byteOffset: indexOffset, byteLength: indexBufferSize, target: 34963 });
        }

        return gltf;
    }

    private arrayToBase64(array: ArrayBuffer): string {
        return Buffer.from(array).toString('base64');
    }

    private smoothMesh(
        positions: Float32Array,
        indices: Uint32Array,
        iterations: number
    ): void {
        if(iterations <= 0) return;
        
        const lambda = 0.5;
        const mu = -0.52;

        console.log(`Applying Taubin smoothing with ${iterations} iterations (lambda=${lambda}, mu=${mu})...`);

        const vertexCount = positions.length / 3;
        const adjacency: Set<number>[] = Array.from({ length: vertexCount }, () => new Set());
        for(let i = 0; i < indices.length; i += 3){
            const v0 = indices[i];
            const v1 = indices[i + 1];
            const v2 = indices[i + 2];
            adjacency[v0].add(v1).add(v2);
            adjacency[v1].add(v0).add(v2);
            adjacency[v2].add(v0).add(v1);
        }

        let currentPositions = positions;
        const tempPositions = new Float32Array(positions.length);

        for(let iter = 0; iter < iterations; iter++){
            // Calculate P' = P + lambda * L(P), where L(P) is the Laplacian vector.
            for (let i = 0; i < vertexCount; i++) {
                const neighbors = Array.from(adjacency[i]);
                const i3 = i * 3;

                if(neighbors.length === 0){
                    tempPositions[i3] = currentPositions[i3];
                    tempPositions[i3 + 1] = currentPositions[i3 + 1];
                    tempPositions[i3 + 2] = currentPositions[i3 + 2];
                    continue;
                }

                let avgX = 0, avgY = 0, avgZ = 0;
                for(const neighborIdx of neighbors){
                    const n3 = neighborIdx * 3;
                    avgX += currentPositions[n3];
                    avgY += currentPositions[n3 + 1];
                    avgZ += currentPositions[n3 + 2];
                }

                avgX /= neighbors.length;
                avgY /= neighbors.length;
                avgZ /= neighbors.length;

                const laplacianX = avgX - currentPositions[i3];
                const laplacianY = avgY - currentPositions[i3 + 1];
                const laplacianZ = avgZ - currentPositions[i3 + 2];

                tempPositions[i3] = currentPositions[i3] + lambda * laplacianX;
                tempPositions[i3 + 1] = currentPositions[i3 + 1] + lambda * laplacianY;
                tempPositions[i3 + 2] = currentPositions[i3 + 2] + lambda * laplacianZ;
            }

            // Computes P'' = P' + mu * L(P'), using the intermediate positions from tempPositions.
            // The final result of the iteration is written directly to the original 'positions' array.
            for(let i = 0; i < vertexCount; i++){
                const neighbors = Array.from(adjacency[i]);
                const i3 = i * 3;

                if(neighbors.length === 0){
                    positions[i3] = tempPositions[i3];
                    positions[i3 + 1] = tempPositions[i3 + 1];
                    positions[i3 + 2] = tempPositions[i3 + 2];
                    continue;
                }

                let avgX = 0, avgY = 0, avgZ = 0;
                for(const neighborIdx of neighbors){
                    const n3 = neighborIdx * 3;
                    avgX += tempPositions[n3];
                    avgY += tempPositions[n3 + 1];
                    avgZ += tempPositions[n3 + 2];
                }

                avgX /= neighbors.length;
                avgY /= neighbors.length;
                avgZ /= neighbors.length;

                const laplacianX = avgX - tempPositions[i3];
                const laplacianY = avgY - tempPositions[i3 + 1];
                const laplacianZ = avgZ - tempPositions[i3 + 2];

                positions[i3] = tempPositions[i3] + mu * laplacianX;
                positions[i3 + 1] = tempPositions[i3 + 1] + mu * laplacianY;
                positions[i3 + 2] = tempPositions[i3 + 2] + mu * laplacianZ;
            }
        }
    }

    public async fromGLTF(inputFilePath: string): Promise<Mesh> {
        console.log(`Loading GLTF file from: ${inputFilePath}`);
        const gltfContent = fs.readFileSync(inputFilePath, 'utf8');
        const gltf = JSON.parse(gltfContent);

        if(!gltf.asset || gltf.asset.version !== '2.0'){
            throw new Error('Invalid GLTF file: Asset version must be 2.0.');
        }

        if(!gltf.meshes || gltf.meshes.length === 0){
            throw new Error('GLTF file contains no meshes.');
        }

        if(!gltf.buffers || gltf.buffers.length === 0){
            throw new Error('GLTF file contains no buffers.');
        }

        if(!gltf.bufferViews || gltf.bufferViews.length === 0){
            throw new Error('GLTF file contains no buffer views.');
        }

        if(!gltf.accessors || gltf.accessors.length === 0){
            throw new Error('GLTF file contains no accessors.');
        }

        const meshGLTF = gltf.meshes[0];
        if(!meshGLTF.primitives || meshGLTF.primitives.length === 0){
            throw new Error('Mesh in GLTF file contains no primitives.');
        }

        const primitive = meshGLTF.primitives[0];

        const buffer = gltf.buffers[0];
        if(!buffer.uri || !buffer.uri.startsWith('data:application/octet-stream;base64,')){
            throw new Error('Unsupported GLTF buffer format. Only base64-encoded buffers are supported for now.');
        }

        const base64Data = buffer.uri.split(',')[1];
        const binaryData = Buffer.from(base64Data, 'base64');

        let positions: [number, number, number][] = [];
        let facets: { vertices: [number, number, number] }[] = [];

        if(primitive.attributes && primitive.attributes.POSITION !== undefined){
            const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
            const positionBufferView = gltf.bufferViews[positionAccessor.bufferView];

            const positionArrayBuffer = new Float32Array(
                binaryData.buffer,
                binaryData.byteOffset + positionBufferView.byteOffset,
                positionBufferView.byteLength / Float32Array.BYTES_PER_ELEMENT
            );

            for(let i = 0; i < positionArrayBuffer.length; i += 3){
                positions.push([
                    positionArrayBuffer[i],
                    positionArrayBuffer[i + 1],
                    positionArrayBuffer[i + 2]
                ]);
            }
        }else{
            throw new Error('GLTF primitive does not contain POSITION attribute.');
        }

        // facets
        if(primitive.indices !== undefined){
            const indexAccessor = gltf.accessors[primitive.indices];
            const indexBufferView = gltf.bufferViews[indexAccessor.bufferView];

            // Determine array type based on componentType (5121=UNSIGNED_BYTE, 5123=UNSIGNED_SHORT, 5125=UNSIGNED_INT)
            let indexArray: Uint8Array | Uint16Array | Uint32Array;
            switch(indexAccessor.componentType){
                // UNSIGNED_BYTE
                case 5121:
                    indexArray = new Uint8Array(
                        binaryData.buffer,
                        binaryData.byteOffset + indexBufferView.byteOffset,
                        indexBufferView.byteLength / Uint8Array.BYTES_PER_ELEMENT
                    );
                    break;
                // UNSIGNED_SHORT
                case 5123:
                    indexArray = new Uint16Array(
                        binaryData.buffer,
                        binaryData.byteOffset + indexBufferView.byteOffset,
                        indexBufferView.byteLength / Uint16Array.BYTES_PER_ELEMENT
                    );
                    break;
                // UNSIGNED_INT
                case 5125: 
                    indexArray = new Uint32Array(
                        binaryData.buffer,
                        binaryData.byteOffset + indexBufferView.byteOffset,
                        indexBufferView.byteLength / Uint32Array.BYTES_PER_ELEMENT
                    );
                    break;
                default:
                    throw new Error(`Unsupported index componentType: ${indexAccessor.componentType}`);
            }

            for(let i = 0; i < indexArray.length; i += 3){
                facets.push({
                    vertices: [indexArray[i], indexArray[i + 1], indexArray[i + 2]]
                });
            }
        }else{
            console.warn('GLTF primitive does not contain indices. Mesh might be a point cloud or line set.');
        }

        const points = positions.map((pos, index) => ({ index, position: pos }));

        console.log(`GLTF loaded: ${points.length} points, ${facets.length} facets.`);

        return {
            data: {
                points,
                facets,
                metadata: gltf.extras || {} 
            }
        };
    }
};

export default MeshExporter;
/*
async function processGltfFile(inputPath: string, outputPath: string, smoothIterations: number) {
    const exporter = new MeshExporter();
    const loadedMesh = await exporter.fromGLTF(inputPath);
    exporter.toGLTF(loadedMesh, outputPath, {
        smoothIterations: smoothIterations,
        generateNormals: true,
        enableDoubleSided: true,
        material: {
            baseColor: [1.0, 1.0, 1.0, 1.0],
            metallic: 0,
            roughness: 0
        },
    });
}

const inputGltfPath = '/home/rodyherrera/Escritorio/Development/OpenDXA/server/storage/trajectories/61b3c0e9-2939-4b31-a872-226948cabe06/gltf/frame_0_defect_mesh.gltf'; // Archivo GLTF de entrada
const outputGltfPath = './output_taubin_smoothed_mesh.gltf'; 
const iterations = 8; 
processGltfFile(inputGltfPath, inputGltfPath, iterations);*/