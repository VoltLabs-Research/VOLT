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
      // Values adjusted for more solid and saturated colors
      ambientFactor: { value: 0.7 },    // Increased from 0.14 to 0.7
      diffuseFactor: { value: 0.6 },   // Reduced from 1.0 to 0.6
      specularFactor: { value: 0.1 },   // Drastically reduced from 0.62 to 0.1
      shininess: { value: 50.0 },  // Reduced from 170.0 to 50.0
      rimFactor: { value: 0.05 },  // Reduced from 0.24 to 0.05
      rimPower: { value: 2.0 },   // Reduced from 3.2 to 2.0
      pointScale: { value: 1.0 },
    },
    vertexColors: true,

    // No transparency for solid colors
    transparent: false,
    opacity: 1.0,

    // Correct Z-buffer
    depthTest: true,
    depthWrite: true,

    // Normal blending
    blending: THREE.NormalBlending,

    // Alpha test to discard fragments
    alphaTest: 0.5,

    dithering: false,
    premultipliedAlpha: false,
  });

  // Dynamic point scaling
  const numPoints = points.geometry.attributes.position.count;
  const VISUAL_ADJUSTMENT_FACTOR = 17;
  const dynamicPointScale = VISUAL_ADJUSTMENT_FACTOR / Math.cbrt(numPoints);
  (mat.uniforms.pointScale as any).value = dynamicPointScale;

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
