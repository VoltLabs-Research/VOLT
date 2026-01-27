import type { StateCreator } from 'zustand';
import type { SlicePlaneConfig, ConfigurationStore, ConfigurationState } from '@/types/stores/editor/configuration';

export interface ConfigurationSlice {
    configuration: ConfigurationStore;
}

const DEFAULT_SLICE_PLANE_CONFIG: SlicePlaneConfig = {
    normal: { x: 0, y: 0, z: 0 },
    distance: 0,
    slabWidth: 0,
    reverseOrientation: false,
};

const initialState: ConfigurationState = {
    slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
    activeSidebarTab: 'Scene',
    activeSidebarOption: '',
    activeModifier: '',
    slicingOrigin: { x: 0, y: 0, z: 0 },
};

export const createConfigurationSlice: StateCreator<any, [], [], ConfigurationSlice> = (set, get) => ({
    configuration: {
        ...initialState,

        setSlicePlaneConfig: (config) => {
            const current = get().configuration.slicePlaneConfig;
            // Handle merging logic locally
            const mergedNormal = { ...current.normal, ...(config.normal || {}) };
            const next = {
                normal: mergedNormal,
                distance: typeof config.distance === 'number' ? config.distance : current.distance,
                slabWidth: typeof config.slabWidth === 'number' ? config.slabWidth : current.slabWidth,
                reverseOrientation: typeof config.reverseOrientation === 'boolean' ? config.reverseOrientation : current.reverseOrientation,
            };
            set((s: any) => ({ configuration: { ...s.configuration, slicePlaneConfig: next } }));
        },

        setSlicingOrigin: (origin) => set((s: any) => ({ configuration: { ...s.configuration, slicingOrigin: origin } })),
        setActiveSidebarOption: (option) => set((s: any) => ({ configuration: { ...s.configuration, activeSidebarOption: option } })),
        setActiveSidebarTag: (tag) => set((s: any) => ({ configuration: { ...s.configuration, activeSidebarTab: tag } })),
        setActiveModifier: (modifier) => set((s: any) => ({ configuration: { ...s.configuration, activeModifier: modifier } })),

        resetSlicePlaneConfig: () => set((s: any) => ({
            configuration: { ...s.configuration, slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG }
        })),

        reset: () => set((s: any) => ({ configuration: { ...s.configuration, ...initialState } }))
    }
});
