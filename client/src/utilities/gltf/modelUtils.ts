import { Box3, Vector3, Sphere } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

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