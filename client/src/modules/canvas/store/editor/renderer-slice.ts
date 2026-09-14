import { resetSectionState } from './store-section';
import {
    getDefaultRendererCreateSettings,
    getDefaultRendererRuntimeSettings
} from '@/shared/rendering/renderer';

import type { EditorStore } from './types';
import type { RendererSettings } from '@/shared/rendering/renderer';
import type { StateCreator } from 'zustand';

export interface RendererSlice {
    rendererSettings: RendererSettings & {
        reset: () => void;
    };
}

const getInitialRendererSettings = (): RendererSettings => ({
    create: getDefaultRendererCreateSettings(),
    runtime: getDefaultRendererRuntimeSettings()
});

export const createRendererSlice: StateCreator<EditorStore, [], [], RendererSlice> = (set) => ({
    rendererSettings: {
        ...getInitialRendererSettings(),
        reset: () => set((state) => resetSectionState(state, 'rendererSettings', getInitialRendererSettings()))
    }
});
