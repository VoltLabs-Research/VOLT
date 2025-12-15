export const CHROMATIC_ABERRATION_DEFAULT = {
    enabled: false,
    offset: 0.005,
};

export const DEPTH_OF_FIELD_DEFAULT = {
    enabled: false,
    focusDistance: 0,
    focalLength: 0.02,
    bokehScale: 2,
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
};

export const PIXELATION_DEFAULT = {
    enabled: false,
    granularity: 5,
};

export const NOISE_DEFAULT = {
    enabled: false,
    opacity: 0.1,
};

export const VIGNETTE_DEFAULT = {
    enabled: false,
    darkness: 0.5,
    offset: 0.5,
};

export const SEPIA_DEFAULT = {
    enabled: false,
    intensity: 1.0,
};

export const SSAO_EFFECT_DEFAULT = {
    enabled: false,
    samples: 16,
    radius: 0.5,
    intensity: 1.0,
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
