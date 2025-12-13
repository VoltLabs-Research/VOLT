import { BlendFunction } from 'postprocessing';

export interface CameraConfig{
    position: [number, number, number],
    fov: number;
    near: number;
    far: number;
    up:  [number, number, number]
}

export interface GLConfig{
    localClippingEnabled: boolean;
    alpha: boolean;
    antialias: boolean;
    powerPreference: string;
    stencil: boolean;
    depth: boolean;
    logarithmicDepthBuffer: boolean;
    preserveDrawingBuffer: boolean;
    failIfMajorPerformanceCaveat: boolean;
    desynchronized: boolean;
    precision: boolean;
    xrCompatible: boolean;
    autoClear: boolean;
    autoClearColor: boolean;
    autoClearDepth: boolean;
    autoClearStencil: boolean;
}

export interface SSAOConfig{
    blendFunction: BlendFunction;
    intensity: number;
    radius: number;
    luminanceInfluence: number;
    worldDistanceThreshold: number;
    worldDistanceFalloff: number;
    worldProximityThreshold: number;
    worldProximityFalloff: number;
}

export interface OrbitControlsConfig{
    makeDefault: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    rotateSpeed: number;
    maxDistance: number;
    minDistance: number;
    target: [number, number, number];
    enablePan: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
}

export interface RenderConfigState{
    orbitControls: OrbitControlsConfig;
    SSAO: SSAOConfig;
    camera: CameraConfig;
    gl: GLConfig;
}

export interface RenderConfigActions {
    reset: () => void;
}

export type RenderConfigStore = RenderConfigState & RenderConfigActions;

export const GL_DEFAULT_CONFIG = {
    localClippingEnabled: true,
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: true,
    desynchronized: false,
    precision: 'highp',
    xrCompatible: false,
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: false,
};

export const SSAO_DEFAULT_CONFIG = {
    blendFunction: BlendFunction.MULTIPLY,
    intensity: 5,
    radius: 0.1,
    luminanceInfluence: 0.5,
    worldDistanceThreshold: 0.5,
    worldDistanceFalloff: 0.3,
    worldProximityThreshold: 0.5,
    worldProximityFalloff: 0.3
};

export const ORBIT_CONTROLS_DEFAULT_CONFIG = {
    makeDefault: true,
    enableDamping: true,
    dampingFactor: 0.08,
    rotateSpeed: 1.0,
    maxDistance: 50,
    minDistance: 2,
    target: [0, 2, 0] as [number, number, number],
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
};
