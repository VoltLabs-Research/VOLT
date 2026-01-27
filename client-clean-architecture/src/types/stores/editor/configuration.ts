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
    resetSlicePlaneConfig: () => void;
    setSlicingOrigin: (origin: { x: number; y: number; z: number }) => void;
    setActiveSidebarTag: (tag: string) => void;
    setActiveModifier: (modifier: string) => void;
    setActiveSidebarOption: (option: string) => void;
    reset: () => void;
}

export type ConfigurationStore = ConfigurationState & ConfigurationActions;
