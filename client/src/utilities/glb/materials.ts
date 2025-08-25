import * as THREE from 'three';
import vertexShader from '@/shaders/point-cloud.vert?raw';
import fragmentShader from '@/shaders/point-cloud.frag?raw';
import { getOptimizedMaterial } from '@/utilities/glb/modelUtils';

export const configurePointCloudMaterial = (points: THREE.Points) => {
    points.material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            cameraPosition: { value: new THREE.Vector3() },
            ambientFactor: { value: 0.14 },
            diffuseFactor: { value: 0.72 },
            specularFactor: { value: 0.62 },
            shininess: { value: 170.0 },
            rimFactor: { value: 0.24 },
            rimPower: { value: 3.2 },
            pointScale: { value: 1.0 }
        },
        vertexColors: true,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        clipping: true
    });

    const numPoints = points.geometry.attributes.position.count;
    const VISUAL_ADJUSTMENT_FACTOR = 17;
    const dynamicPointScale = VISUAL_ADJUSTMENT_FACTOR / Math.cbrt(numPoints);
    (points.material as THREE.ShaderMaterial).uniforms.pointScale.value = dynamicPointScale;
};

export const configureGeometry = (model: THREE.Group, sliceClippingPlanes: any, setMesh: (m: THREE.Mesh) => void) => {
    let mainGeometry: THREE.BufferGeometry | null = null;
    model.traverse((child) => {
        if(child instanceof THREE.Mesh && !mainGeometry){
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
        if(child instanceof THREE.Points){
            pointClouds = child;
        }
    });

    return pointClouds;
};