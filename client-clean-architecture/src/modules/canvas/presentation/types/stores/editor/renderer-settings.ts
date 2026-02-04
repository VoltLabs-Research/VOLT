export type ToneMappingMode = 'None' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic' | 'AgX' | 'Neutral';
export type OutputCS = 'SRGB' | 'LinearSRGB' | 'DisplayP3' | 'LinearDisplayP3';
export type ShadowType = 'Basic' | 'PCF' | 'PCFSoft' | 'VSM';
export type PrecisionType = 'highp' | 'mediump' | 'lowp';

export type RendererCreateState = {
    antialias: boolean;
    alpha: boolean;
    depth: boolean;
    stencil: boolean;
    logarithmicDepthBuffer: boolean;
    preserveDrawingBuffer: boolean;
    premultipliedAlpha: boolean;
    failIfMajorPerformanceCaveat: boolean;
    precision: PrecisionType;
};

export type RendererRuntimeState = {
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

    useLegacyLights: boolean;

    gammaFactor: number;
    maxMorphTargets: number;
    maxMorphNormals: number;
};

export type RendererSettingsState = {
    create: RendererCreateState;
    runtime: RendererRuntimeState;
};

export type RendererSettingsActions = {
    setCreate: (partial: Partial<RendererCreateState>) => void;
    setRuntime: (partial: Partial<RendererRuntimeState>) => void;
    resetCreate: () => void;
    resetRuntime: () => void;
    reset: () => void;
};

export type RendererSettingsStore = RendererSettingsState & RendererSettingsActions;
