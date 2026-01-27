import type { SliceCreator } from '@/shared/presentation/stores/helpers';

export interface SlicePlaneConfig {
    normal: { x: number; y: number; z: number };
    distance: number;
    slabWidth: number;
    reverseOrientation: boolean;
}

export interface ConfigurationState {
    slicePlaneConfig: SlicePlaneConfig;
    activeSidebarTab: string;
    activeSidebarOption: string;
    activeModifier: string;
    slicingOrigin: { x: number; y: number; z: number };
}

export interface ConfigurationActions {
    setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => void;
    setActiveSidebarTab: (tag: string) => void;
    setActiveSidebarOption: (option: string) => void;
    setActiveModifier: (modifier: string) => void;
    resetConfiguration: () => void;
}

export type ConfigurationSlice = ConfigurationState & ConfigurationActions;

const DEFAULT_SLICE_PLANE_CONFIG: SlicePlaneConfig = {
    normal: { x: 0, y: 0, z: 0 },
    distance: 0,
    slabWidth: 0,
    reverseOrientation: false,
};

export const initialState: ConfigurationState = {
    slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
    activeSidebarTab: 'Scene',
    activeSidebarOption: '',
    activeModifier: '',
    slicingOrigin: { x: 0, y: 0, z: 0 },
};

export const createConfigurationSlice: SliceCreator<ConfigurationSlice> = (set, get) => ({
    ...initialState,

    setSlicePlaneConfig: (config) => {
        const current = get().slicePlaneConfig;
        const next = {
            ...current,
            ...config,
            normal: { ...current.normal, ...(config.normal || {}) }
        };
        set({ slicePlaneConfig: next });
    },

    setActiveSidebarTab: (tag) => set({ activeSidebarTab: tag }),
    setActiveSidebarOption: (option) => set({ activeSidebarOption: option }),
    setActiveModifier: (modifier) => set({ activeModifier: modifier }),

    resetConfiguration: () => {
        set(initialState);
    }
});
