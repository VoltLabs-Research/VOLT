export type ToneMappingMode = 'None' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic' | 'AgX' | 'Neutral';
export type OutputCS = 'SRGB' | 'LinearSRGB' | 'DisplayP3' | 'LinearDisplayP3';
export type ShadowType = 'Basic' | 'PCF' | 'PCFSoft' | 'VSM';
export type PrecisionType = 'highp' | 'mediump' | 'lowp';

// WebGL Context Creation Settings (require renderer recreation)
export type RendererCreateState = {
    antialias: boolean;
    alpha: boolean;
    depth: boolean;
    stencil: boolean;
    logarithmicDepthBuffer: boolean;
    preserveDrawingBuffer: boolean;
    premultipliedAlpha: boolean; // Use premultiplied alpha
    failIfMajorPerformanceCaveat: boolean; // Fail if no GPU acceleration
    precision: PrecisionType; // Shader precision
};

// Runtime Renderer Settings (can be changed on the fly)
export type RendererRuntimeState = {
    // Tone Mapping & Color
    toneMapping: ToneMappingMode;
    toneMappingExposure: number;
    outputColorSpace: OutputCS;

    // Shadow Settings
    shadowEnabled: boolean;
    shadowType: ShadowType;
    shadowAutoUpdate: boolean; // Auto update shadows each frame

    // Clipping & Culling
    localClippingEnabled: boolean;
    sortObjects: boolean; // Sort objects before rendering for transparency

    // Buffer Clearing
    autoClear: boolean; // Master clear setting
    autoClearColor: boolean; // Clear color buffer
    autoClearDepth: boolean; // Clear depth buffer
    autoClearStencil: boolean; // Clear stencil buffer

    // Advanced Rendering
    useLegacyLights: boolean; // Use legacy lighting model (pre-r155)

    // Performance & Quality
    gammaFactor: number; // Gamma correction factor (legacy, prefer outputColorSpace)
    maxMorphTargets: number; // Max morph targets per mesh
    maxMorphNormals: number; // Max morph normals per mesh
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
