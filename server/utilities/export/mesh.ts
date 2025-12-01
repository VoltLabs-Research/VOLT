/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { Mesh, DefectMeshExportOptions, ProcessedMesh } from '@/types/utilities/export/mesh';
import { assembleGLBToBuffer } from '@/utilities/export/utils';
import { buildPrimitiveGLB } from '@/utilities/export/build-primitive';
import taubinSmoothing from '@/utilities/export/taubin-smoothing';
import { putObject } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';

class MeshExporter{
    public toGLBBuffer(
        mesh: Mesh,
        options: DefectMeshExportOptions = {}
    ): Buffer{
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

        const processedMesh = this.processMeshGeometry(mesh, opts);
        const useU16 = processedMesh.vertexCount > 0 && processedMesh.vertexCount <= 65535;
        const indices = useU16 ? new Uint16Array(processedMesh.indices) : processedMesh.indices;

        const { glb, arrayBuffer } = buildPrimitiveGLB({
            positions: processedMesh.positions,
            normals: processedMesh.normals,
            indices,
            mode: 4,
            nodeName: 'Mesh',
            meshName: 'MeshGeometry',
            generator: 'OpenDXA Mesh Exporter',
            copyright: 'https://github.com/rodyherrera/OpenDXA',
            material: {
                baseColor: opts.material.baseColor,
                metallic: opts.material.metallic,
                roughness: opts.material.roughness,
                emissive: opts.material.emissive,
                doubleSided: opts.enableDoubleSided,
                name: 'Mesh'
            },
            extras: opts.metadata.includeOriginalStats ? {
                stats: {
                    vertexCount: processedMesh.vertexCount,
                    triangleCount: processedMesh.triangleCount,
                },
                ...opts.metadata.customProperties
            } : opts.metadata.customProperties
        });

        const accPos = glb.accessors[0];
        accPos.min = processedMesh.bounds.min;
        accPos.max = processedMesh.bounds.max;

        return assembleGLBToBuffer(glb, arrayBuffer);
    }

    public async toGLBMinIO(
        mesh: Mesh,
        minioObjectName: string,
        options: DefectMeshExportOptions = {}
    ): Promise<void>{
        const buffer = this.toGLBBuffer(mesh, options);
        await putObject(minioObjectName, SYS_BUCKETS.MODELS, buffer, { 'Content-Type': 'model/gltf-binary' });
    }

    private processMeshGeometry(mesh: Mesh, options: Required<DefectMeshExportOptions>): ProcessedMesh{
        const { points, facets } = mesh.data;
        const vertexCount = points.length;
        const triangleCount = facets.length;
        
        logger.info(`Processing mesh: ${triangleCount} triangles, ${vertexCount} vertices.`);
        const positions = new Float32Array(vertexCount * 3);
        
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        for(let i = 0; i < vertexCount; i++){
            const position = points[i].position;
            const o = i * 3;

            const x = Number(position[0]);
            const y = Number(position[1]);
            const z = Number(position[2]);

            positions[o] = x;
            positions[o + 1] = y;
            positions[o + 2] = z;

            if(x < minX) minX = x;
            if(y < minY) minY = y; 
            if(z < minZ) minZ = z;
            if(x > maxX) maxX = x; 
            if(y > maxY) maxY = y; 
            if(z > maxZ) maxZ = z;
        }

        let indexCount = 0;
        for(let i = 0; i < triangleCount; i++){
            const v = (facets[i] as any).vertices;
            if(!Array.isArray(v) || v.length !== 3){
                throw new Error(`Facet ${i} not a triangle.`);
            }
            indexCount += 3;
        }

        const indices = new Uint32Array(indexCount);
        let k = 0;
        for(let i = 0; i < triangleCount; i++){
            const v = (facets[i] as any).vertices;
            const a = Number(v[0]);
            const b = Number(v[1]);
            const c = Number(v[2]);

            if(!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c)){
                throw new Error(`Facet ${i} contains non-integer indices: [${a}, ${b}, ${c}]`); 
            }

            if(a < 0 || b < 0 || c < 0 || a >= vertexCount || b >= vertexCount || c >= vertexCount){
                throw new Error(`Facet ${i} with index out of range: [${a}, ${b}, ${c}] vs vertexCount=${vertexCount}`);
            }

            indices[k++] = a;
            indices[k++] = b;
            indices[k++] = c;
        }

        if(options.smoothIterations){
            taubinSmoothing(positions, indices, options.smoothIterations);
        }

        const normals = new Float32Array(vertexCount * 3);
        for(let i = 0; i < indices.length; i += 3){
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            const p0 = i0 * 3;
            const p1 = i1 * 3;
            const p2 = i2 * 3;

            const e1x = positions[p1] - positions[p0];
            const e1y = positions[p1 + 1] - positions[p0 + 1];
            const e1z = positions[p1 + 2] - positions[p0 + 2];

            const e2x = positions[p2] - positions[p0];
            const e2y = positions[p2 + 1] - positions[p0 + 1];
            const e2z = positions[p2 + 2] - positions[p0 + 2];

            const nx = (e1y * e2z) - (e1z * e2y);
            const ny = (e1z * e2x) - (e1x * e2z);
            const nz = (e1x * e2y) - (e1y * e2x);

            normals[p0] += nx; normals[p0 + 1] += ny; 
            normals[p0 + 2] += nz;
            
            normals[p1] += nx; normals[p1 + 1] += ny; 
            normals[p1 + 2] += nz;
            
            normals[p2] += nx; normals[p2 + 1] += ny; 
            normals[p2 + 2] += nz;
        }
         
        for(let i = 0; i < normals.length; i += 3){
            const nx = normals[i];
            const ny = normals[i + 1];
            const nz = normals[i + 2];

            const len = Math.hypot(nx, ny, nz);
            if(len > 1e-6){
                normals[i] /= len; 
                normals[i + 1] /= len; 
                normals[i + 2] /= len; 
            }else{
                normals[i] = 0; 
                normals[i + 1] = 0; 
                normals[i + 2] = 1;
            }
        }

        const bounds = { 
            min: [minX, minY, minZ] as [number, number, number],
            max: [maxX, maxY, maxZ] as [number, number, number] 
        };

        return { positions, normals, indices, vertexCount, triangleCount, bounds };
    }
};

export default MeshExporter;