import type { StateCreator } from 'zustand';
import type { RendererSettingsStore, RendererSettingsState, RendererCreateState, RendererRuntimeState } from '@/modules/fractal/presentation/types/stores/editor/performance-types';

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

export const createRendererSlice: StateCreator<any, [], [], RendererSlice> = (set) => ({
    rendererSettings: {
        ...INITIAL,
        setCreate: (partial: Partial<RendererCreateState>) => set((s: RendererSlice) => ({
            rendererSettings: { ...s.rendererSettings, create: { ...s.rendererSettings.create, ...partial } }
        })),
        setRuntime: (partial: Partial<RendererRuntimeState>) => set((s: RendererSlice) => ({
            rendererSettings: { ...s.rendererSettings, runtime: { ...s.rendererSettings.runtime, ...partial } }
        })),
        resetCreate: () => set((s: RendererSlice) => ({
            rendererSettings: { ...s.rendererSettings, create: { ...INITIAL.create } }
        })),
        resetRuntime: () => set((s: RendererSlice) => ({
            rendererSettings: { ...s.rendererSettings, runtime: { ...INITIAL.runtime } }
        })),
        reset: () => set((s: RendererSlice) => ({
            rendererSettings: { ...s.rendererSettings, ...INITIAL }
        }))
    }
});
