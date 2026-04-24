import { PowerPreference } from '@/shared/domain/rendering/performance';
import {
    ACESFilmicToneMapping,
    AgXToneMapping,
    BasicShadowMap,
    CineonToneMapping,
    LinearToneMapping,
    NeutralToneMapping,
    NoToneMapping,
    PCFShadowMap,
    PCFSoftShadowMap,
    ReinhardToneMapping,
    VSMShadowMap
} from 'three';

import type { ShadowMapType, ToneMapping } from 'three';

export interface RenderingOption<TValue> {
    value: TValue;
    title: string;
};

export interface RendererCreateSettings {
    antialias: boolean;
    alpha: boolean;
    depth: boolean;
    stencil: boolean;
    logarithmicDepthBuffer: boolean;
    preserveDrawingBuffer: boolean;
    premultipliedAlpha: boolean;
    failIfMajorPerformanceCaveat: boolean;
    precision: PrecisionType;
    powerPreference: PowerPreference;
};

export interface RendererRuntimeSettings {
    toneMapping: ToneMappingMode;
    toneMappingExposure: number;
    outputColorSpace: OutputCS;
    shadowEnabled: boolean;
    shadowType: ShadowType;
    shadowAutoUpdate: boolean;
    localClippingEnabled: boolean;
    sortObjects: boolean;
    autoClear: boolean;
    autoClearColor: boolean;
    autoClearDepth: boolean;
    autoClearStencil: boolean;
};

export interface RendererSettings {
    create: RendererCreateSettings;
    runtime: RendererRuntimeSettings;
};

export enum ToneMappingMode {
    None = 'None',
    Linear = 'Linear',
    Reinhard = 'Reinhard',
    Cineon = 'Cineon',
    ACESFilmic = 'ACESFilmic',
    AgX = 'AgX',
    Neutral = 'Neutral'
};

export enum OutputCS {
    SRGB = 'SRGB',
    LinearSRGB = 'LinearSRGB',
    DisplayP3 = 'DisplayP3',
    LinearDisplayP3 = 'LinearDisplayP3'
};

export enum ShadowType {
    Basic = 'Basic',
    PCF = 'PCF',
    PCFSoft = 'PCFSoft',
    VSM = 'VSM'
};

export enum PrecisionType {
    High = 'highp',
    Medium = 'mediump',
    Low = 'lowp'
};

export const RENDERER_TONE_MAPPING_OPTIONS: RenderingOption<ToneMappingMode>[] = [
    { title: 'None', value: ToneMappingMode.None },
    { title: 'Linear', value: ToneMappingMode.Linear },
    { title: 'Reinhard', value: ToneMappingMode.Reinhard },
    { title: 'Cineon', value: ToneMappingMode.Cineon },
    { title: 'ACES Filmic', value: ToneMappingMode.ACESFilmic },
    { title: 'AgX', value: ToneMappingMode.AgX },
    { title: 'Neutral', value: ToneMappingMode.Neutral }
];

export const RENDERER_SHADOW_TYPE_OPTIONS: RenderingOption<ShadowType>[] = [
    { title: 'Basic', value: ShadowType.Basic },
    { title: 'PCF', value: ShadowType.PCF },
    { title: 'PCF Soft', value: ShadowType.PCFSoft },
    { title: 'VSM', value: ShadowType.VSM }
];

export const RENDERER_SUBSECTION_TITLES = {
    toneMapping: 'Tone Mapping',
    shadows: 'Shadows'
};

export const RENDERER_CREATE_DEFAULTS: RendererCreateSettings = {
    antialias: true,
    alpha: true,
    depth: true,
    stencil: false,
    logarithmicDepthBuffer: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: true,
    failIfMajorPerformanceCaveat: false,
    precision: PrecisionType.High,
    powerPreference: PowerPreference.HighPerformance
};

export const RENDERER_RUNTIME_DEFAULTS: RendererRuntimeSettings = {
    toneMapping: ToneMappingMode.None,
    toneMappingExposure: 5,
    outputColorSpace: OutputCS.SRGB,
    shadowEnabled: false,
    shadowType: ShadowType.PCF,
    shadowAutoUpdate: true,
    localClippingEnabled: false,
    sortObjects: true,
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true
};

export const getDefaultRendererCreateSettings = (): RendererCreateSettings => ({
    ...RENDERER_CREATE_DEFAULTS
});

export const getDefaultRendererRuntimeSettings = (): RendererRuntimeSettings => ({
    ...RENDERER_RUNTIME_DEFAULTS
});

/** Maps a renderer tone-mapping mode to the Three.js runtime constant. */
export const resolveToneMapping = (mode: ToneMappingMode): ToneMapping => {
    if (mode === ToneMappingMode.ACESFilmic) {
        return ACESFilmicToneMapping;
    }

    if (mode === ToneMappingMode.AgX) {
        return AgXToneMapping;
    }

    if (mode === ToneMappingMode.Neutral) {
        return NeutralToneMapping;
    }

    if (mode === ToneMappingMode.Cineon) {
        return CineonToneMapping;
    }

    if (mode === ToneMappingMode.Reinhard) {
        return ReinhardToneMapping;
    }

    if (mode === ToneMappingMode.Linear) {
        return LinearToneMapping;
    }

    return NoToneMapping;
};

/** Maps a renderer shadow mode to the Three.js runtime constant. */
export const resolveShadowMapType = (type: ShadowType): ShadowMapType => {
    if (type === ShadowType.PCF) {
        return PCFShadowMap;
    }

    if (type === ShadowType.PCFSoft) {
        return PCFSoftShadowMap;
    }

    if (type === ShadowType.VSM) {
        return VSMShadowMap;
    }

    return BasicShadowMap;
};

/** Maps a renderer output color-space mode to the renderer runtime string. */
export const resolveOutputColorSpace = (colorSpace: OutputCS): string => {
    if (colorSpace === OutputCS.LinearSRGB) {
        return 'srgb-linear';
    }

    if (colorSpace === OutputCS.DisplayP3) {
        return 'display-p3';
    }

    if (colorSpace === OutputCS.LinearDisplayP3) {
        return 'display-p3-linear';
    }

    return 'srgb';
};

/** Store-contract aliases — expose renderer settings as named state/action types. */
export type RendererCreateState = RendererCreateSettings;
export type RendererRuntimeState = RendererRuntimeSettings;
export type RendererSettingsState = RendererSettings;

export interface RendererSettingsActions {
    setCreate: (partial: Partial<RendererCreateState>) => void;
    setRuntime: (partial: Partial<RendererRuntimeState>) => void;
    resetCreate: () => void;
    resetRuntime: () => void;
    reset: () => void;
};

export type RendererSettingsStore = RendererSettingsState & RendererSettingsActions;
