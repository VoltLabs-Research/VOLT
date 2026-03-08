import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { SliceAxis } from '@/modules/fractal/types/configuration';

export const AXES: SliceAxis[] = [SliceAxis.X, SliceAxis.Y, SliceAxis.Z];

export interface UseSlicePlaneReturn {
    slicePlaneConfig: {
        activeAxes: SliceAxis[];
        positions: Record<SliceAxis, number>;
        angles: Record<SliceAxis, number>;
    };
    handleAxisClick: (axis: SliceAxis) => void;
    handlePositionChange: (axis: SliceAxis, value: number) => void;
    handleAngleChange: (axis: SliceAxis, value: number) => void;
    isAxisActive: (axis: SliceAxis) => boolean;
};

const useSlicePlane = (): UseSlicePlaneReturn => {
    const {
        slicePlaneConfig,
        toggleSliceAxis,
        setSlicePosition,
        setSliceAngle
    } = useEditorStore(useShallow((s) => ({
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        toggleSliceAxis: s.configuration.toggleSliceAxis,
        setSlicePosition: s.configuration.setSlicePosition,
        setSliceAngle: s.configuration.setSliceAngle
    })));

    const handleAxisClick = useCallback((axis: SliceAxis) => {
        toggleSliceAxis(axis);
    }, [toggleSliceAxis]);

    const handlePositionChange = useCallback((axis: SliceAxis, value: number) => {
        setSlicePosition(axis, value);
    }, [setSlicePosition]);

    const handleAngleChange = useCallback((axis: SliceAxis, value: number) => {
        setSliceAngle(axis, value);
    }, [setSliceAngle]);

    const isAxisActive = useCallback((axis: SliceAxis) => {
        return slicePlaneConfig.activeAxes.includes(axis);
    }, [slicePlaneConfig.activeAxes]);

    return {
        slicePlaneConfig,
        handleAxisClick,
        handlePositionChange,
        handleAngleChange,
        isAxisActive
    };
};

export default useSlicePlane;
