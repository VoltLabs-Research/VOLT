import type { StateCreator } from 'zustand';
import type { RendererSettingsStore, RendererSettingsState, RendererCreateState, RendererRuntimeState } from '@/modules/fractal/types/stores/editor/performance-types';
import type { EditorStore } from './types';
import { mergeNestedSectionState, resetSectionState } from './store-section';

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
        autoClearStencil: true
    }
};

export const createRendererSlice: StateCreator<EditorStore, [], [], RendererSlice> = (set) => ({
    rendererSettings: {
        ...INITIAL,
        setCreate: (partial: Partial<RendererCreateState>) => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'create', partial)),
        setRuntime: (partial: Partial<RendererRuntimeState>) => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'runtime', partial)),
        resetCreate: () => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'create', INITIAL.create)),
        resetRuntime: () => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'runtime', INITIAL.runtime)),
        reset: () => set((state) => resetSectionState(state, 'rendererSettings', INITIAL))
    }
});
