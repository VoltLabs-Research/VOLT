import type {
    SliceAxis,
    ModelWorldBounds,
    SlicePlaneConfig
} from '@/modules/fractal/api/entities/fractal';

export type { SliceAxis, ModelWorldBounds, SlicePlaneConfig };

export interface ConfigurationState {
    slicePlaneConfig: SlicePlaneConfig;
    activeSidebarOption: string;
    activeModifier: string;
};

export interface ConfigurationActions {
    setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => void;
    resetSlicePlaneConfig: () => void;
    toggleSliceAxis: (axis: SliceAxis) => void;
    setSlicePosition: (axis: SliceAxis, position: number) => void;
    setSliceAngle: (axis: SliceAxis, angle: number) => void;
    setActiveModifier: (modifier: string) => void;
    setActiveSidebarOption: (option: string) => void;
    reset: () => void;
};

export type ConfigurationStore = ConfigurationState & ConfigurationActions;
