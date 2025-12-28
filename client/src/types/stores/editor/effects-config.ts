export const CHROMATIC_ABERRATION_DEFAULT = {
    enabled: false,
    offset: [0.005, 0.005] as [number, number],
    blendFunction: 0
};
// Note: BlendFunction is usually imported from postprocessing or three, but here we just need consistency.
// The lint earlier complained about missing properties for ChromaticAberration.
// Type '{ key: string; blendFunction: any; offset: Vector2; }' is missing ... radialModulation, modulationOffset

export const DEPTH_OF_FIELD_DEFAULT = {
    enabled: false,
    focusDistance: 0,
    focalLength: 0.02,
    bokehScale: 2,
    blendFunction: 0,
    height: 480
};

export const SCANLINE_DEFAULT = {
    enabled: false,
    density: 1.5,
};

export const GOD_RAYS_DEFAULT = {
    enabled: false,
    exposure: 0.6,
    decay: 0.9,
    density: 0.8,
    weight: 0.4,
};

export const OUTLINE_DEFAULT = {
    enabled: false,
    thickness: 1.5,
    color: '#ffffff',
};

export const COLOR_GRADING_DEFAULT = {
    enabled: false,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
};

export const BLOOM_EFFECT_DEFAULT = {
    enabled: false,
    intensity: 1.0,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025,
    kernelSize: 3,
    blendFunction: 0
};

export const PIXELATION_DEFAULT = {
    enabled: false,
    granularity: 5,
};

export const NOISE_DEFAULT = {
    enabled: false,
    opacity: 0.1,
    blendFunction: 0,
    premultiply: false
};

export const VIGNETTE_DEFAULT = {
    enabled: false,
    darkness: 0.5,
    offset: 0.5,
    blendFunction: 0,
    eskil: false
};

export const SEPIA_DEFAULT = {
    enabled: false,
    intensity: 1.0,
    blendFunction: 0
};

export const SSAO_EFFECT_DEFAULT = {
    enabled: false,
    samples: 16,
    radius: 0.5,
    intensity: 1.0,
    blendFunction: 0,
    luminanceInfluence: 0.7,
    worldDistanceThreshold: 0.5, // Added defaults for lint
    worldDistanceFalloff: 0.1,
    worldProximityThreshold: 0.5,
    worldProximityFalloff: 0.1
};

export const TILT_SHIFT_DEFAULT = {
    enabled: false,
    focusArea: 0.5,
    blur: 0.5,
};

export const FILM_DEFAULT = {
    enabled: false,
    scanlineIntensity: 0.5,
    noiseIntensity: 0.35,
    grayscale: false,
};

export interface EffectsConfigState {
    ssao: typeof SSAO_EFFECT_DEFAULT;
    bloom: typeof BLOOM_EFFECT_DEFAULT;
    chromaticAberration: typeof CHROMATIC_ABERRATION_DEFAULT;
    vignette: typeof VIGNETTE_DEFAULT;
    depthOfField: typeof DEPTH_OF_FIELD_DEFAULT;
    noise: typeof NOISE_DEFAULT;
    sepia: typeof SEPIA_DEFAULT;
}

export interface EffectsConfigActions {
    setSSAOEffect: (config: Partial<typeof SSAO_EFFECT_DEFAULT>) => void;
    setBloomEffect: (config: Partial<typeof BLOOM_EFFECT_DEFAULT>) => void;
    setChromaticAberration: (config: Partial<typeof CHROMATIC_ABERRATION_DEFAULT>) => void;
    setVignette: (config: Partial<typeof VIGNETTE_DEFAULT>) => void;
    setDepthOfField: (config: Partial<typeof DEPTH_OF_FIELD_DEFAULT>) => void;
    setNoise: (config: Partial<typeof NOISE_DEFAULT>) => void;
    setSepia: (config: Partial<typeof SEPIA_DEFAULT>) => void;
    reset: () => void;
}

export type EffectsConfigStore = EffectsConfigState & EffectsConfigActions;
