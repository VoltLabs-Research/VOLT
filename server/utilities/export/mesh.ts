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
};

export default MeshExporter;