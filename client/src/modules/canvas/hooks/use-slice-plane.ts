import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SLICE_PLANE_CONFIG, getSlicePlaneCenterDistance, isSlicePlaneConfigPristine } from '@/modules/fractal/utilities/slice-plane';

import type { SlicePlaneNormalAxis } from '@/modules/fractal/api/entities/scene';

const NON_COMMITTABLE_NUMERIC_INPUTS = new Set(['', '-', '+', '.', '-.', '+.']);

const isFiniteNumericInput = (value: string): value is string => {
    if (NON_COMMITTABLE_NUMERIC_INPUTS.has(value.trim())) {
        return false;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed);
};

export interface UseSlicePlaneReturn {
    enabled: boolean;
    distanceInput: string;
    normalInputs: Record<SlicePlaneNormalAxis, string>;
    reverseOrientation: boolean;
    visualizePlane: boolean;
    handleEnabledChange: (_fieldKey: string, value: string | number | boolean) => void;
    handleDistanceChange: (_fieldKey: string, value: string | number | boolean) => void;
    handleNormalChange: (axis: SlicePlaneNormalAxis) => (_fieldKey: string, value: string | number | boolean) => void;
    handleReverseOrientationChange: (_fieldKey: string, value: string | number | boolean) => void;
    handleVisualizePlaneChange: (_fieldKey: string, value: string | number | boolean) => void;
}

const useSlicePlane = (): UseSlicePlaneReturn => {
    const {
        slicePlaneConfig,
        modelWorldBounds,
        setSlicePlaneConfig,
        setSlicePlaneEnabled,
        setSlicePlaneDistance,
        setSlicePlaneNormalComponent,
        setSlicePlaneReverseOrientation,
        setSlicePlaneVisualizePlane
    } = useEditorStore(useShallow((s) => ({
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        modelWorldBounds: s.modelWorldBounds,
        setSlicePlaneConfig: s.configuration.setSlicePlaneConfig,
        setSlicePlaneEnabled: s.configuration.setSlicePlaneEnabled,
        setSlicePlaneDistance: s.configuration.setSlicePlaneDistance,
        setSlicePlaneNormalComponent: s.configuration.setSlicePlaneNormalComponent,
        setSlicePlaneReverseOrientation: s.configuration.setSlicePlaneReverseOrientation,
        setSlicePlaneVisualizePlane: s.configuration.setSlicePlaneVisualizePlane
    })));

    const [distanceInput, setDistanceInput] = useState(() => String(slicePlaneConfig.distance));
    const [normalInputs, setNormalInputs] = useState<Record<SlicePlaneNormalAxis, string>>(() => ({
        x: String(slicePlaneConfig.normal.x),
        y: String(slicePlaneConfig.normal.y),
        z: String(slicePlaneConfig.normal.z)
    }));

    useEffect(() => {
        setDistanceInput(String(slicePlaneConfig.distance));
    }, [slicePlaneConfig.distance]);

    useEffect(() => {
        setNormalInputs({
            x: String(slicePlaneConfig.normal.x),
            y: String(slicePlaneConfig.normal.y),
            z: String(slicePlaneConfig.normal.z)
        });
    }, [slicePlaneConfig.normal.x, slicePlaneConfig.normal.y, slicePlaneConfig.normal.z]);

    useEffect(() => {
        if (!modelWorldBounds || !isSlicePlaneConfigPristine(slicePlaneConfig)) {
            return;
        }

        const centeredDistance = getSlicePlaneCenterDistance(slicePlaneConfig, modelWorldBounds);
        if (centeredDistance === slicePlaneConfig.distance) {
            return;
        }

        setSlicePlaneConfig({
            distance: centeredDistance
        });
    }, [modelWorldBounds, setSlicePlaneConfig, slicePlaneConfig]);

    const handleEnabledChange = useCallback((_fieldKey: string, value: string | number | boolean) => {
        const nextEnabled = Boolean(value);

        if (nextEnabled && modelWorldBounds && slicePlaneConfig.distance === DEFAULT_SLICE_PLANE_CONFIG.distance) {
            setSlicePlaneConfig({
                enabled: true,
                distance: getSlicePlaneCenterDistance(slicePlaneConfig, modelWorldBounds)
            });
            return;
        }

        setSlicePlaneEnabled(nextEnabled);
    }, [modelWorldBounds, setSlicePlaneConfig, setSlicePlaneEnabled, slicePlaneConfig]);

    const handleDistanceChange = useCallback((_fieldKey: string, value: string | number | boolean) => {
        const nextValue = String(value);
        setDistanceInput(nextValue);

        if (!isFiniteNumericInput(nextValue)) {
            return;
        }

        setSlicePlaneDistance(Number(nextValue));
    }, [setSlicePlaneDistance]);

    const handleNormalChange = useCallback((axis: SlicePlaneNormalAxis) => {
        return (_fieldKey: string, value: string | number | boolean) => {
            const nextValue = String(value);

            setNormalInputs((current) => ({
                ...current,
                [axis]: nextValue
            }));

            if (!isFiniteNumericInput(nextValue)) {
                return;
            }

            setSlicePlaneNormalComponent(axis, Number(nextValue));
        };
    }, [setSlicePlaneNormalComponent]);

    const handleReverseOrientationChange = useCallback((_fieldKey: string, value: string | number | boolean) => {
        setSlicePlaneReverseOrientation(Boolean(value));
    }, [setSlicePlaneReverseOrientation]);

    const handleVisualizePlaneChange = useCallback((_fieldKey: string, value: string | number | boolean) => {
        setSlicePlaneVisualizePlane(Boolean(value));
    }, [setSlicePlaneVisualizePlane]);

    return {
        enabled: slicePlaneConfig.enabled,
        distanceInput,
        normalInputs,
        reverseOrientation: slicePlaneConfig.reverseOrientation,
        visualizePlane: slicePlaneConfig.visualizePlane,
        handleEnabledChange,
        handleDistanceChange,
        handleNormalChange,
        handleReverseOrientationChange,
        handleVisualizePlaneChange
    };
};

export default useSlicePlane;
