import { SliceAxis } from '@/modules/fractal/api/entities/scene';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { SlicePlaneConfig } from '@/modules/fractal/api/entities/scene';

export { SliceAxis };
export type { ModelWorldBounds, SlicePlaneConfig };

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
