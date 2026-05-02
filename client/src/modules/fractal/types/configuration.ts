import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { SlicePlaneConfig, SlicePlaneNormalAxis } from '@/modules/fractal/api/entities/scene';

export type { ModelWorldBounds, SlicePlaneConfig, SlicePlaneNormalAxis };

export interface ConfigurationState {
    slicePlaneConfig: SlicePlaneConfig;
    activeSidebarOption: string;
    activeModifier: string;
}

export interface ConfigurationActions {
    setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => void;
    resetSlicePlaneConfig: () => void;
    setSlicePlaneEnabled: (enabled: boolean) => void;
    setSlicePlaneDistance: (distance: number) => void;
    setSlicePlaneNormalComponent: (axis: SlicePlaneNormalAxis, value: number) => void;
    setSlicePlaneReverseOrientation: (reverseOrientation: boolean) => void;
    setSlicePlaneVisualizePlane: (visualizePlane: boolean) => void;
    setActiveModifier: (modifier: string) => void;
    setActiveSidebarOption: (option: string) => void;
    reset: () => void;
}

export type ConfigurationStore = ConfigurationState & ConfigurationActions;
