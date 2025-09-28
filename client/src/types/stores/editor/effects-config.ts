import { BlendFunction } from 'postprocessing';

export interface SSAOEffectConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    intensity: number;
    radius: number;
    luminanceInfluence: number;
    worldDistanceThreshold: number;
    worldDistanceFalloff: number;
    worldProximityThreshold: number;
    worldProximityFalloff: number;
}

export interface BloomEffectConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    intensity: number;
    luminanceThreshold: number;
    luminanceSmoothing: number;
    kernelSize: number;
}

export interface ChromaticAberrationConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    offset: [number, number];
}

export interface VignetteConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    eskil: boolean;
    offset: number;
    darkness: number;
}

export interface DepthOfFieldConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    focusDistance: number;
    focalLength: number;
    bokehScale: number;
    height: number;
}

export interface FilmConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    nIntensity: number;
    sIntensity: number;
    sCount: number;
    grayscale: boolean;
}

export interface PixelationConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    granularity: number;
}

export interface OutlineConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    edgeStrength: number;
    pulseSpeed: number;
    visibleEdgeColor: number;
    hiddenEdgeColor: number;
}

export interface ColorGradingConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    gamma: number;
}

export interface GodRaysConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    density: number;
    decay: number;
    weight: number;
    exposure: number;
    samples: number;
}

export interface NoiseConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    premultiply: boolean;
}

export interface ScanlineConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    density: number;
}

export interface SepiaConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    intensity: number;
}

export interface TiltShiftConfig{
    enabled: boolean;
    blendFunction: BlendFunction;
    offset: number;
    rotation: number;
    focusArea: number;
    feather: number;
    kernelSize: number;    
}

export interface EffectsConfigState{
    ssao: SSAOEffectConfig;
    bloom: BloomEffectConfig;
    chromaticAberration: ChromaticAberrationConfig;
    vignette: VignetteConfig;
    depthOfField: DepthOfFieldConfig;
    noise: NoiseConfig;
    sepia: SepiaConfig;
}

export interface EffectsConfigActions{
    setSSAOEffect: (config: Partial<SSAOEffectConfig>) => void;
    setBloomEffect: (config: Partial<BloomEffectConfig>) => void;
    setChromaticAberration: (config: Partial<ChromaticAberrationConfig>) => void;
    setVignette: (config: Partial<VignetteConfig>) => void;
    setDepthOfField: (config: Partial<DepthOfFieldConfig>) => void;
    setNoise: (config: Partial<NoiseConfig>) => void;
    setSepia: (config: Partial<SepiaConfig>) => void;
    reset: () => void;
}

export type EffectsConfigStore = EffectsConfigState & EffectsConfigActions;


export const SSAO_EFFECT_DEFAULT: SSAOEffectConfig = {
    enabled: false,
    blendFunction: BlendFunction.MULTIPLY,
    intensity: 5,
    radius: 0.1,
    luminanceInfluence: 0.5,
    worldDistanceThreshold: 0.5,
    worldDistanceFalloff: 0.3,
    worldProximityThreshold: 0.5,
    worldProximityFalloff: 0.3
};

export const BLOOM_EFFECT_DEFAULT: BloomEffectConfig = {
    enabled: false,
    blendFunction: BlendFunction.SCREEN,
    intensity: 1.0,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025,
    kernelSize: 3
};

export const CHROMATIC_ABERRATION_DEFAULT: ChromaticAberrationConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    offset: [0.001, 0.001]
};

export const VIGNETTE_DEFAULT: VignetteConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    eskil: false,
    offset: 0.5,
    darkness: 0.5
};

export const DEPTH_OF_FIELD_DEFAULT: DepthOfFieldConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    focusDistance: 0.02,
    focalLength: 0.5,
    bokehScale: 1.0,
    height: 480
};

export const FILM_DEFAULT: FilmConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    nIntensity: 0.35,
    sIntensity: 0.95,
    sCount: 4096,
    grayscale: false
};

export const PIXELATION_DEFAULT: PixelationConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    granularity: 5
};

export const OUTLINE_DEFAULT: OutlineConfig = {
    enabled: false,
    blendFunction: BlendFunction.SCREEN,
    edgeStrength: 3.0,
    pulseSpeed: 0.0,
    visibleEdgeColor: 0xffffff,
    hiddenEdgeColor: 0x22090a
};

export const COLOR_GRADING_DEFAULT: ColorGradingConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    brightness: 0.0,
    contrast: 0.0,
    saturation: 0.0,
    hue: 0.0,
    gamma: 1.0
};

export const GOD_RAYS_DEFAULT: GodRaysConfig = {
    enabled: false,
    blendFunction: BlendFunction.SCREEN,
    density: 0.96,
    decay: 0.92,
    weight: 0.4,
    exposure: 0.6,
    samples: 60
};

export const NOISE_DEFAULT: NoiseConfig = {
    enabled: false,
    blendFunction: BlendFunction.SCREEN,
    premultiply: false
};

export const SCANLINE_DEFAULT: ScanlineConfig = {
    enabled: false,
    blendFunction: BlendFunction.OVERLAY,
    density: 1.25
};

export const SEPIA_DEFAULT: SepiaConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    intensity: 1.0
};

export const TILT_SHIFT_DEFAULT: TiltShiftConfig = {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    offset: 0.0,
    rotation: 0.0,
    focusArea: 0.4,
    feather: 0.3,
    kernelSize: 25
};