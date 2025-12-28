import { Box3, Vector3, Sphere } from 'three';
import * as THREE from 'three';

type MaterialCache = Map<string, THREE.MeshStandardMaterial>;
export type TimelineGLBMap = Record<number, string>;

const cache: MaterialCache = new Map();

export const getOptimizedMaterial = (
    baseMaterial: THREE.Material,
    clippingPlanes: THREE.Plane[]
): THREE.MeshStandardMaterial => {
    const key = `${baseMaterial.uuid}-${clippingPlanes.length}`;
    if (cache.has(key)) {
        const cached = cache.get(key)!;
        // @ts-ignore
        cached.clippingPlanes = clippingPlanes;
        return cached;
    }

    if (baseMaterial instanceof THREE.MeshStandardMaterial) {
        baseMaterial = new THREE.MeshStandardMaterial({
            color: baseMaterial.color,
            map: baseMaterial.map,
            normalMap: baseMaterial.normalMap,
            roughnessMap: baseMaterial.roughnessMap,
            metalnessMap: baseMaterial.metalnessMap,
            emissiveMap: baseMaterial.emissiveMap,
            emissive: baseMaterial.emissive,
            roughness: baseMaterial.roughness,
            metalness: baseMaterial.metalness,
            opacity: baseMaterial.opacity,
            vertexColors: baseMaterial.vertexColors,
            clipShadows: true,
            transparent: false,
            alphaTest: 0.1,
            side: THREE.FrontSide,
            depthWrite: true,
            depthTest: true,
        });
    } else if (baseMaterial instanceof THREE.MeshBasicMaterial) {
        baseMaterial = new THREE.MeshStandardMaterial({
            color: baseMaterial.color,
            map: baseMaterial.map,
            opacity: baseMaterial.opacity,
            vertexColors: baseMaterial.vertexColors,
            clipShadows: true,
            transparent: false,
            alphaTest: 0.1,
            side: THREE.FrontSide,
            depthWrite: true,
            depthTest: true,
        });
    } else {
        baseMaterial = baseMaterial.clone();
    }

    // @ts-ignore
    if (clippingPlanes.length > 0) baseMaterial.clippingPlanes = clippingPlanes;
    // @ts-ignore(baseMaterial as any).clipIntersection = true;
    // @ts-ignore
    baseMaterial.precision = 'highp';
    // @ts-ignore
    baseMaterial.fog = false;
    // @ts-ignore
    baseMaterial.userData.isOptimized = true;
    // @ts-ignore
    return baseMaterial;
};

export const calculateModelBounds = (glb: any) => {
    const box = new Box3().setFromObject(glb.scene);
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
    const rotation = shouldRotate ? { x: Math.PI / 2, y: 0, z: 0 } : { x: 0, y: 0, z: 0 };

    const position = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale,
    };

    return { position, rotation, scale };
};

export const calculateClosestCameraPositionZY = (modelBounds: Box3, camera: any) => {
    const center = modelBounds.getCenter(new THREE.Vector3());
    const size = modelBounds.getSize(new THREE.Vector3());

    const viewHeight = size.z;
    const viewWidth = size.y;
    const fovRad = THREE.MathUtils.degToRad(camera.fov);

    let distByHeight = (viewHeight / 2) / Math.tan(fovRad / 2);
    let distByWidth = (viewWidth / 2) / (Math.tan(fovRad / 2) * camera.aspect);

    let distance = Math.max(distByHeight, distByWidth);
    distance *= 1.01;

    return {
        position: new THREE.Vector3(center.x + distance, center.y, center.z),
        target: center.clone(),
        up: new THREE.Vector3(0, 0, 1)
    };
};
