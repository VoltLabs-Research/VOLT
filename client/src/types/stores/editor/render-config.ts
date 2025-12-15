export const ORBIT_CONTROLS_DEFAULT_CONFIG = {
    enableDamping: true,
    dampingFactor: 0.05,
    rotateSpeed: 1.0,
    zoomSpeed: 1.2,
    panSpeed: 0.8,
    minDistance: 1,
    maxDistance: 100,
    enabled: true,
};

export const SSAO_DEFAULT_CONFIG = {
    enabled: false,
    samples: 32,
    radius: 0.5,
    intensity: 1.0,
    bias: 0.01,
    kernelRadius: 8,
    minDistance: 0.001,
    maxDistance: 0.1,
};

export const GL_DEFAULT_CONFIG = {
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance' as const,
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    preserveDrawingBuffer: false,
};
