import type { StateCreator } from 'zustand';
import type { RendererSettingsStore, RendererSettingsState } from '@/types/stores/editor/renderer-settings';

export interface RendererSlice {
    rendererSettings: RendererSettingsStore;
}

const INITIAL: RendererSettingsState = {
    create: {
        // Anti-aliasing & Alpha
        antialias: false,
        alpha: false,

        // Buffers
        depth: true,
        stencil: false,
        logarithmicDepthBuffer: false,
        preserveDrawingBuffer: false,

        // Advanced WebGL Context
        premultipliedAlpha: true,
        failIfMajorPerformanceCaveat: false,
        precision: 'highp'
    },
    runtime: {
        // Tone Mapping & Color
        toneMapping: 'None',
        toneMappingExposure: 1,
        outputColorSpace: 'SRGB',

        // Shadow Settings
        shadowEnabled: false,
        shadowType: 'PCF',
        shadowAutoUpdate: true,

        // Clipping & Culling
        localClippingEnabled: false,
        sortObjects: true,

        // Buffer Clearing
        autoClear: true,
        autoClearColor: true,
        autoClearDepth: true,
        autoClearStencil: true,

        // Advanced Rendering
        useLegacyLights: false,

        // Performance & Quality
        gammaFactor: 2.0,
        maxMorphTargets: 8,
        maxMorphNormals: 4
    }
};

export const createRendererSlice: StateCreator<any, [], [], RendererSlice> = (set, get) => ({
    rendererSettings: {
        ...INITIAL,
        setCreate: (partial) => set((s) => ({
            rendererSettings: { ...s.rendererSettings, create: { ...s.rendererSettings.create, ...partial } }
        })),
        setRuntime: (partial) => set((s) => ({
            rendererSettings: { ...s.rendererSettings, runtime: { ...s.rendererSettings.runtime, ...partial } }
        })),
        resetCreate: () => set((s) => ({
            rendererSettings: { ...s.rendererSettings, create: { ...INITIAL.create } }
        })),
        resetRuntime: () => set((s) => ({
            rendererSettings: { ...s.rendererSettings, runtime: { ...INITIAL.runtime } }
        })),
        reset: () => set((s) => ({
            rendererSettings: { ...s.rendererSettings, ...INITIAL }
        }))
    }
});
