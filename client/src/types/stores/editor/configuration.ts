export type SliceAxis = 'x' | 'y' | 'z';

export interface SlicePlaneConfig {
    activeAxes: SliceAxis[];
    positions: Record<SliceAxis, number>;
    angles: Record<SliceAxis, number>;
    showHelper: boolean;
}

export interface ConfigurationState {
    slicePlaneConfig: SlicePlaneConfig;
    activeSidebarTab: string;
    activeSidebarOption: string;
    activeModifier: string;
}

export interface ConfigurationActions {
    setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => void;
    resetSlicePlaneConfig: () => void;
    toggleSliceAxis: (axis: SliceAxis) => void;
    setSlicePosition: (axis: SliceAxis, position: number) => void;
    setSliceAngle: (axis: SliceAxis, angle: number) => void;
    setActiveSidebarTag: (tag: string) => void;
    setActiveModifier: (modifier: string) => void;
    setActiveSidebarOption: (option: string) => void;
    reset: () => void;
}

export type ConfigurationStore = ConfigurationState & ConfigurationActions;
