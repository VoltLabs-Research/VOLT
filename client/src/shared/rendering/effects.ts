import { BlendFunction } from 'postprocessing';

export interface ChromaticAberrationSettings {
    enabled: boolean;
    offset: [number, number];
    blendFunction: number;
};

export interface DepthOfFieldSettings {
    enabled: boolean;
    focusDistance: number;
    focalLength: number;
    bokehScale: number;
    blendFunction: number;
    height: number;
};

export interface BloomSettings {
    enabled: boolean;
    intensity: number;
    luminanceThreshold: number;
    luminanceSmoothing: number;
    kernelSize: number;
    blendFunction: number;
};

export interface NoiseSettings {
    enabled: boolean;
    opacity: number;
    blendFunction: number;
    premultiply: boolean;
};

export interface VignetteSettings {
    enabled: boolean;
    darkness: number;
    offset: number;
    blendFunction: number;
    eskil: boolean;
};

export interface SepiaSettings {
    enabled: boolean;
    intensity: number;
    blendFunction: number;
};

export interface SSAOEffectSettings {
    enabled: boolean;
    samples: number;
    radius: number;
    intensity: number;
    blendFunction: number;
    luminanceInfluence: number;
    worldDistanceThreshold: number;
    worldDistanceFalloff: number;
    worldProximityThreshold: number;
    worldProximityFalloff: number;
};

export interface EffectsSettings {
    ssao: SSAOEffectSettings;
    bloom: BloomSettings;
    chromaticAberration: ChromaticAberrationSettings;
    vignette: VignetteSettings;
    depthOfField: DepthOfFieldSettings;
    noise: NoiseSettings;
    sepia: SepiaSettings;
};

export enum EffectSectionId {
    SSAO = 'ssao',
    Bloom = 'bloom',
    ChromaticAberration = 'chromaticAberration',
    Vignette = 'vignette',
    DepthOfField = 'depthOfField',
    Sepia = 'sepia',
    Noise = 'noise'
};

export const EFFECT_SECTION_ORDER: EffectSectionId[] = [
    EffectSectionId.SSAO,
    EffectSectionId.Bloom,
    EffectSectionId.ChromaticAberration,
    EffectSectionId.Vignette,
    EffectSectionId.DepthOfField,
    EffectSectionId.Sepia,
    EffectSectionId.Noise
];

export const EFFECT_SECTION_TITLES: Record<EffectSectionId, string> = {
    [EffectSectionId.SSAO]: 'SSAO',
    [EffectSectionId.Bloom]: 'Bloom',
    [EffectSectionId.ChromaticAberration]: 'Chromatic Aberration',
    [EffectSectionId.Vignette]: 'Vignette',
    [EffectSectionId.DepthOfField]: 'Depth of Field',
    [EffectSectionId.Sepia]: 'Sepia',
    [EffectSectionId.Noise]: 'Noise'
};

const CHROMATIC_ABERRATION_DEFAULTS: ChromaticAberrationSettings = {
    enabled: false,
    offset: [0.005, 0.005],
    blendFunction: BlendFunction.NORMAL
};

const DEPTH_OF_FIELD_DEFAULTS: DepthOfFieldSettings = {
    enabled: false,
    focusDistance: 0,
    focalLength: 0.02,
    bokehScale: 2,
    blendFunction: BlendFunction.NORMAL,
    height: 480
};

const BLOOM_EFFECT_DEFAULTS: BloomSettings = {
    enabled: false,
    intensity: 1.0,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025,
    kernelSize: 3,
    blendFunction: BlendFunction.SCREEN
};

const NOISE_EFFECT_DEFAULTS: NoiseSettings = {
    enabled: false,
    opacity: 0.1,
    blendFunction: BlendFunction.SCREEN,
    premultiply: false
};

const VIGNETTE_EFFECT_DEFAULTS: VignetteSettings = {
    enabled: false,
    darkness: 0.5,
    offset: 0.5,
    blendFunction: BlendFunction.NORMAL,
    eskil: false
};

const SEPIA_EFFECT_DEFAULTS: SepiaSettings = {
    enabled: false,
    intensity: 1.0,
    blendFunction: BlendFunction.NORMAL
};

const SSAO_EFFECT_DEFAULTS: SSAOEffectSettings = {
    enabled: false,
    samples: 16,
    radius: 0.5,
    intensity: 1.0,
    blendFunction: BlendFunction.MULTIPLY,
    luminanceInfluence: 0.7,
    worldDistanceThreshold: 0.5,
    worldDistanceFalloff: 0.1,
    worldProximityThreshold: 0.5,
    worldProximityFalloff: 0.1
};

const getDefaultSSAOEffectSettings = (): SSAOEffectSettings => ({
    ...SSAO_EFFECT_DEFAULTS
});

export const getDefaultEffectsSettings = (): EffectsSettings => ({
    ssao: getDefaultSSAOEffectSettings(),
    bloom: { ...BLOOM_EFFECT_DEFAULTS },
    chromaticAberration: {
        ...CHROMATIC_ABERRATION_DEFAULTS,
        offset: [
            CHROMATIC_ABERRATION_DEFAULTS.offset[0],
            CHROMATIC_ABERRATION_DEFAULTS.offset[1]
        ]
    },
    vignette: { ...VIGNETTE_EFFECT_DEFAULTS },
    depthOfField: { ...DEPTH_OF_FIELD_DEFAULTS },
    noise: { ...NOISE_EFFECT_DEFAULTS },
    sepia: { ...SEPIA_EFFECT_DEFAULTS }
});

export const resolveSSAOSettings = (
    settings: SSAOEffectSettings
): SSAOEffectSettings | null => {
    if (!settings.enabled) {
        return null;
    }

    return { ...settings };
};
