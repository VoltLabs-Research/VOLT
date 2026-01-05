import * as THREE from 'three';
import vertexShader from '@/shaders/point-cloud.vert?raw';
import fragmentShader from '@/shaders/point-cloud.frag?raw';
import { getOptimizedMaterial } from '@/utilities/glb/modelUtils';

export const configurePointCloudMaterial = (points: THREE.Points) => {
    const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            cameraPosition: { value: new THREE.Vector3() },
            ambientFactor: { value: 0.7 },
            diffuseFactor: { value: 0.6 },
            specularFactor: { value: 0.1 },
            shininess: { value: 50.0 },
            rimFactor: { value: 0.05 },
            rimPower: { value: 2.0 },
            pointScale: { value: 1.0 },
        },
        vertexColors: true,
        transparent: false,
        opacity: 1.0,
        depthTest: true,
        depthWrite: true,
        blending: THREE.NormalBlending,
        alphaTest: 0.5,
        dithering: false,
        premultipliedAlpha: false,
    });

    const numPoints = points.geometry.attributes.position.count;
    const VISUAL_ADJUSTMENT_FACTOR = 17;
    const dynamicPointScale = VISUAL_ADJUSTMENT_FACTOR / Math.cbrt(numPoints);
    (mat.uniforms.pointScale as any).value = dynamicPointScale;
    mat.userData.basePointScale = dynamicPointScale;

    points.material = mat;
};

export const configureGeometry = (model: THREE.Group, sliceClippingPlanes: any, setMesh: (m: THREE.Mesh) => void) => {
    let mainGeometry: THREE.BufferGeometry | null = null;
    model.traverse((child) => {
        if (child instanceof THREE.Mesh && !mainGeometry) {
            mainGeometry = child.geometry;
            child.frustumCulled = true;
            child.visible = true;
            child.material = getOptimizedMaterial(child.material, sliceClippingPlanes);
            setMesh(child);
        }
    });
};

export const isPointCloudObject = (model: THREE.Group): THREE.Points | null => {
    let pointClouds: THREE.Points | null = null;
    model.traverse((child) => {
        if (child instanceof THREE.Points) {
            pointClouds = child;
        }
    });

    return pointClouds;
};
