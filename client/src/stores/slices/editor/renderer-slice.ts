import type { StateCreator } from 'zustand';
import type { RendererSettingsStore, RendererSettingsState } from '@/types/stores/editor/renderer-settings';

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
        preserveDrawingBuffer: false
    },
    runtime: {
        toneMapping: 'None',
        toneMappingExposure: 1,
        outputColorSpace: 'SRGB',
        physicallyCorrectLights: false,
        localClippingEnabled: false,
        autoClear: true,
        shadowEnabled: false,
        shadowType: 'Basic'
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
