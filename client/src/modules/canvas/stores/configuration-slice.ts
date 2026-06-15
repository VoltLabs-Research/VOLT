import { resetSectionState, setSectionFieldState } from './editor/store-section';

import type { EditorStore } from './editor/types';
import type { ConfigurationStore, ConfigurationState } from '@/modules/fractal/types/configuration';
import type { StateCreator } from 'zustand';

export interface ConfigurationSlice {
    configuration: ConfigurationStore;
}

const initialState: ConfigurationState = {
    activeSidebarOption: '',
    activeModifier: '',
};

export const createConfigurationSlice: StateCreator<EditorStore, [], [], ConfigurationSlice> = (set) => ({
    configuration: {
        ...initialState,

        setActiveSidebarOption: (option: string) => set((state) => setSectionFieldState(state, 'configuration', 'activeSidebarOption', option)),
        setActiveModifier: (modifier: string) => set((state) => setSectionFieldState(state, 'configuration', 'activeModifier', modifier)),

        reset: () => set((state) => resetSectionState(state, 'configuration', initialState))
    }
});
