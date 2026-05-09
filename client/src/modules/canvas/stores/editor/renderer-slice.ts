import { mergeNestedSectionState, resetSectionState } from './store-section';
import {
    getDefaultRendererCreateSettings,
    getDefaultRendererRuntimeSettings
} from '@/shared/domain/rendering/renderer';

import type { EditorStore } from './types';
import type { RendererCreateState, RendererRuntimeState, RendererSettingsState, RendererSettingsStore } from '@/shared/domain/rendering/renderer';
import type { StateCreator } from 'zustand';

export interface RendererSlice {
    rendererSettings: RendererSettingsStore;
}

const getInitialRendererSettings = (): RendererSettingsState => ({
    create: getDefaultRendererCreateSettings(),
    runtime: getDefaultRendererRuntimeSettings()
});

export const createRendererSlice: StateCreator<EditorStore, [], [], RendererSlice> = (set) => ({
    rendererSettings: {
        ...getInitialRendererSettings(),
        setCreate: (partial: Partial<RendererCreateState>) => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'create', partial)),
        setRuntime: (partial: Partial<RendererRuntimeState>) => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'runtime', partial)),
        resetCreate: () => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'create', getDefaultRendererCreateSettings())),
        resetRuntime: () => set((state) => mergeNestedSectionState(state, 'rendererSettings', 'runtime', getDefaultRendererRuntimeSettings())),
        reset: () => set((state) => resetSectionState(state, 'rendererSettings', getInitialRendererSettings()))
    }
});
