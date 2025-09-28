export type ToneMappingMode = 'None' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic';
export type OutputCS = 'SRGB' | 'LinearSRGB';
export type ShadowType = 'Basic' | 'PCF' | 'PCFSoft' | 'VSM';

export type RendererCreateState = {
    antialias: boolean;
    alpha: boolean;
    depth: boolean;
    stencil: boolean;
    logarithmicDepthBuffer: boolean;
    preserveDrawingBuffer: boolean;
};

export type RendererRuntimeState = {
    toneMapping: ToneMappingMode;
    toneMappingExposure: number;
    outputColorSpace: OutputCS;
    physicallyCorrectLights: boolean;
    localClippingEnabled: boolean;
    autoClear: boolean;
    shadowEnabled: boolean;
    shadowType: ShadowType;
};

export type RendererSettingsState = {
    create: RendererCreateState;
    runtime: RendererRuntimeState;
};

export type RendererSettingsActions = {
    setCreate: (partial: Partial<RendererCreateState>) => void;
    setRuntime: (partial: Partial<RendererRuntimeState>) => void;
    reset: () => void;
};

export type RendererSettingsStore = RendererSettingsState & RendererSettingsActions;