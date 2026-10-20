import { resetSectionState, setSectionFieldState } from './store-section';

import type { EditorStore } from './types';
import type { StateCreator } from 'zustand';

interface ConfigurationState {
    activeSidebarOption: string;
    activeModifier: string;
}

interface ConfigurationActions {
    setActiveModifier: (modifier: string) => void;
    setActiveSidebarOption: (option: string) => void;
    reset: () => void;
}

type ConfigurationStore = ConfigurationState & ConfigurationActions;

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
