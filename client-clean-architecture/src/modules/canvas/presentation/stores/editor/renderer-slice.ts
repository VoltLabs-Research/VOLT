import type { StateCreator } from 'zustand';
import type { RendererSettingsStore, RendererSettingsState } from '@/modules/canvas/presentation/types/stores/editor/renderer-settings';

export interface RendererSlice {
    rendererSettings: RendererSettingsStore;
}

const INITIAL: RendererSettingsState = {
    create: {
        antialias: false,
        alpha: false,
        depth: true,
        stencil: false,
        logarithmicDepthBuffer: false,
        preserveDrawingBuffer: false,
        premultipliedAlpha: true,
        failIfMajorPerformanceCaveat: false,
        precision: 'highp'
    },
    runtime: {
        toneMapping: 'None',
        toneMappingExposure: 1,
        outputColorSpace: 'SRGB',

        shadowEnabled: false,
        shadowType: 'PCF',
        shadowAutoUpdate: true,

        localClippingEnabled: false,
        sortObjects: true,

        autoClear: true,
        autoClearColor: true,
        autoClearDepth: true,
        autoClearStencil: true,

        useLegacyLights: false,

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
