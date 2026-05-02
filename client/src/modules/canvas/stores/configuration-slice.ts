import { mergeNestedSectionState, resetSectionState, setSectionFieldState } from './editor/store-section';

import type { EditorStore } from './editor/types';
import type { SlicePlaneConfig, ConfigurationStore, ConfigurationState } from '@/modules/fractal/types/configuration';
import { DEFAULT_SLICE_PLANE_CONFIG } from '@/modules/fractal/utilities/slice-plane';
import type { StateCreator } from 'zustand';

export interface ConfigurationSlice {
    configuration: ConfigurationStore;
}

const initialState: ConfigurationState = {
    slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
    activeSidebarOption: '',
    activeModifier: '',
};

export const createConfigurationSlice: StateCreator<EditorStore, [], [], ConfigurationSlice> = (set, get) => ({
    configuration: {
        ...initialState,

        setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => {
            const current = get().configuration.slicePlaneConfig;
            const next = { ...current, ...config };
            set((state) => setSectionFieldState(state, 'configuration', 'slicePlaneConfig', next));
        },

        setSlicePlaneEnabled: (enabled: boolean) => {
            set((state) => mergeNestedSectionState(state, 'configuration', 'slicePlaneConfig', {
                enabled
            }));
        },

        setSlicePlaneDistance: (distance: number) => {
            set((state) => mergeNestedSectionState(state, 'configuration', 'slicePlaneConfig', {
                distance
            }));
        },

        setSlicePlaneNormalComponent: (axis, value: number) => {
            const current = get().configuration.slicePlaneConfig.normal;
            set((state) => mergeNestedSectionState(state, 'configuration', 'slicePlaneConfig', {
                normal: { ...current, [axis]: value }
            }));
        },

        setSlicePlaneReverseOrientation: (reverseOrientation: boolean) => {
            set((state) => mergeNestedSectionState(state, 'configuration', 'slicePlaneConfig', {
                reverseOrientation
            }));
        },

        setSlicePlaneVisualizePlane: (visualizePlane: boolean) => {
            set((state) => mergeNestedSectionState(state, 'configuration', 'slicePlaneConfig', {
                visualizePlane
            }));
        },

        setActiveSidebarOption: (option: string) => set((state) => setSectionFieldState(state, 'configuration', 'activeSidebarOption', option)),
        setActiveModifier: (modifier: string) => set((state) => setSectionFieldState(state, 'configuration', 'activeModifier', modifier)),

        resetSlicePlaneConfig: () => set((state) => setSectionFieldState(state, 'configuration', 'slicePlaneConfig', DEFAULT_SLICE_PLANE_CONFIG)),

        reset: () => set((state) => resetSectionState(state, 'configuration', initialState))
    }
});
