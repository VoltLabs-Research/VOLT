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

import { Box3, Vector3, Sphere } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

// TODO: CLEAR
type MaterialCache = Map<string, THREE.MeshStandardMaterial>;

export const getOptimizedMaterial = (
    baseMaterial: THREE.Material,
    clippingPlanes: THREE.Plane[],
    cache: MaterialCache
): THREE.MeshStandardMaterial => {
    const key = `${baseMaterial.uuid}-${clippingPlanes.length}`;

    if(cache.has(key)){
        const cached = cache.get(key)!;
        cached.clippingPlanes = clippingPlanes;
        return cached;
    }

    const base = baseMaterial as THREE.MeshStandardMaterial;
    const optimized = new THREE.MeshStandardMaterial({
        color: base.color,
        map: base.map,
        normalMap: base.normalMap,
        roughnessMap: base.roughnessMap,
        metalnessMap: base.metalnessMap,
        clippingPlanes,
        clipShadows: true,
        transparent: false,
        alphaTest: 0.1,
        side: THREE.FrontSide,
        depthWrite: true,
        depthTest: true,
    });

    cache.set(key, optimized);
    return optimized;
};

export const calculateModelBounds = (gltf: GLTF) => {
    const box = new Box3().setFromObject(gltf.scene);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    const boundingSphere = new Sphere();
    box.getBoundingSphere(boundingSphere);

    return {
        box,
        size,
        center,
        boundingSphere,
        maxDimension: Math.max(size.x, size.y, size.z),
    };
};

export const calculateOptimalTransforms = (bounds: ReturnType<typeof calculateModelBounds>) => {
    const { size, center, maxDimension } = bounds;
    const targetSize = 8;
    const scale = maxDimension > 0 ? targetSize / maxDimension : 1;

    const shouldRotate = size.y > size.z * 1.2 || size.z < Math.min(size.x, size.y) * 0.8;
    const rotation = shouldRotate 
        ? { x: Math.PI / 2, y: 0, z: 0 } 
        : { x: 0, y: 0, z: 0 };

    const position = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale,
    };

    return { position, rotation, scale };
};