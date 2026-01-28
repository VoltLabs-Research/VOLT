import type { StateCreator } from 'zustand';
import type { SlicePlaneConfig, ConfigurationStore, ConfigurationState, SliceAxis } from '@/types/stores/editor/configuration';

export interface ConfigurationSlice {
    configuration: ConfigurationStore;
}

const DEFAULT_SLICE_PLANE_CONFIG: SlicePlaneConfig = {
    activeAxes: [],
    positions: { x: 5, y: 5, z: 5 },
    angles: { x: 0, y: 0, z: 0 },
    showHelper: true,
};

const initialState: ConfigurationState = {
    slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
    activeSidebarTab: 'Scene',
    activeSidebarOption: '',
    activeModifier: '',
};

export const createConfigurationSlice: StateCreator<any, [], [], ConfigurationSlice> = (set, get) => ({
    configuration: {
        ...initialState,

        setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => {
            const current = get().configuration.slicePlaneConfig;
            const next = { ...current, ...config };
            set((s: any) => ({ configuration: { ...s.configuration, slicePlaneConfig: next } }));
        },

        toggleSliceAxis: (axis: SliceAxis) => {
            const current = get().configuration.slicePlaneConfig.activeAxes as SliceAxis[];
            const isActive = current.includes(axis);
            const next = isActive 
                ? current.filter((a: SliceAxis) => a !== axis)
                : [...current, axis];
            set((s: any) => ({
                configuration: {
                    ...s.configuration,
                    slicePlaneConfig: { ...s.configuration.slicePlaneConfig, activeAxes: next }
                }
            }));
        },

        setSlicePosition: (axis: SliceAxis, position: number) => {
            const current = get().configuration.slicePlaneConfig.positions;
            set((s: any) => ({
                configuration: {
                    ...s.configuration,
                    slicePlaneConfig: { 
                        ...s.configuration.slicePlaneConfig, 
                        positions: { ...current, [axis]: position }
                    }
                }
            }));
        },

        setSliceAngle: (axis: SliceAxis, angle: number) => {
            const current = get().configuration.slicePlaneConfig.angles;
            set((s: any) => ({
                configuration: {
                    ...s.configuration,
                    slicePlaneConfig: { 
                        ...s.configuration.slicePlaneConfig, 
                        angles: { ...current, [axis]: angle }
                    }
                }
            }));
        },

        setActiveSidebarOption: (option: string) => set((s: any) => ({ configuration: { ...s.configuration, activeSidebarOption: option } })),
        setActiveSidebarTag: (tag: string) => set((s: any) => ({ configuration: { ...s.configuration, activeSidebarTab: tag } })),
        setActiveModifier: (modifier: string) => set((s: any) => ({ configuration: { ...s.configuration, activeModifier: modifier } })),

        resetSlicePlaneConfig: () => set((s: any) => ({
            configuration: { ...s.configuration, slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG }
        })),

        reset: () => set((s: any) => ({ configuration: { ...s.configuration, ...initialState } }))
    }
});
