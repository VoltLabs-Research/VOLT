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

import { BufferGeometry } from 'three';
import * as THREE from 'three';

// Cache for storing LOD geometries to avoid regenerating them
const lodGeometryCache = new Map<string, BufferGeometry>();

/**
 * Creates a Level of Detail (LOD) geometry by reducing vertex count
 * @param baseGeometry - The original geometry to create LOD from
 * @param lodLevel - LOD level (0.15 = 15% of original vertices, 1.0 = 100%)
 * @returns A new geometry with reduced vertex count
*/
export const createLODGeometry = (
    baseGeometry: BufferGeometry,
    lodLevel: number
): BufferGeometry => {
    // Return original geometry if LOD level is 1 or higher
    if(lodLevel >= 1) return baseGeometry;

    const cacheKey = `${baseGeometry.uuid}-lod-${lodLevel}`;

    if(lodGeometryCache.has(cacheKey)){
        return lodGeometryCache.get(cacheKey)!;
    }

    const positions = baseGeometry.attributes.position;
    if(!positions) return baseGeometry;

    const originalCount = positions.count;
    const targetCount = Math.max(1, Math.floor(originalCount * lodLevel));
    const step = Math.max(1, Math.floor(originalCount / targetCount));
    
    const newPositions = new Float32Array(targetCount * 3);
    let newIndex = 0;

    // Sample vertices based on step size
    for(let i = 0; i < originalCount && newIndex < targetCount; i += step){
        const srcIndex = i * 3;
        const dstIndex = newIndex * 3;


        newPositions[dstIndex] = positions.array[srcIndex];
        newPositions[dstIndex + 1] = positions.array[srcIndex + 1];
        newPositions[dstIndex + 2] = positions.array[srcIndex + 2];

        newIndex++;
    }

    // Create new geometry with reduced vertices
    const lodGeometry = new BufferGeometry();
    lodGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));

    // Copy other attributes if they exist (normals, colors, etc.)
    if(baseGeometry.attributes.normal){
        const normals = baseGeometry.attributes.normal;
        const newNormals = new Float32Array(targetCount * 3);
        newIndex = 0;

        for(let i = 0; i < originalCount && newIndex < targetCount; i += step){
            const srcIndex = i * 3;
            const dstIndex = newIndex * 3;

            newNormals[dstIndex] = normals.array[srcIndex];
            newNormals[dstIndex + 1] = normals.array[srcIndex + 1];
            newNormals[dstIndex + 2] = normals.array[srcIndex + 2];

            newIndex++;
        }

        lodGeometry.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
    }

    if(baseGeometry.attributes.color){
        const colors = baseGeometry.attributes.color;
        const newColors = new Float32Array(targetCount * 3);
        newIndex = 0;

        for(let i = 0; i < originalCount && newIndex < targetCount; i += step){
            const srcIndex = i * 3;
            const dstIndex = newIndex * 3;

            newColors[dstIndex] = colors.array[srcIndex];
            newColors[dstIndex + 1] = colors.array[srcIndex + 1];
            newColors[dstIndex + 2] = colors.array[srcIndex + 2];

            newIndex++;
        }

        lodGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
    }

    if(baseGeometry.attributes.uv){
        const uvs = baseGeometry.attributes.uv;
        const newUVs = new Float32Array(targetCount * 2);
        newIndex = 0;

        for(let i = 0; i < originalCount && newIndex < targetCount; i += step){
            const srcIndex = i * 2;
            const dstIndex = newIndex * 2;

            newUVs[dstIndex] = uvs.array[srcIndex];
            newUVs[dstIndex + 1] = uvs.array[srcIndex + 1];

            newIndex++;
        }

        lodGeometry.setAttribute('uv', new THREE.BufferAttribute(newUVs, 2));
    }

    // Copy bounding box and sphere if they exist
    if(baseGeometry.boundingBox){
        lodGeometry.computeBoundingBox();
    }

    if(baseGeometry.boundingSphere){
        lodGeometry.computeBoundingSphere();
    }

    // Cache the result
    lodGeometryCache.set(cacheKey, lodGeometry);

    return lodGeometry;
};