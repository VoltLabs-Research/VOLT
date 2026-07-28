import type * as THREE from 'three';

export interface FractalSurface {
    scene: THREE.Scene;
    camera: THREE.Camera;
    gl: THREE.WebGLRenderer;
    invalidate: () => void;
}

export interface MortonAttributePayload {
    name: string;
    itemSize: number;
    array: Float32Array;
}
