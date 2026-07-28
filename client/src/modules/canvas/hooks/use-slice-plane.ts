import { useCanvasPipelineStore } from '@/modules/canvas/store/canvas-pipeline';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SlicePlaneNormalAxis } from '@/modules/fractal/contracts/scene';
import type { SlicePlaneStageConfig } from '@/modules/canvas/store/canvas-pipeline';

const NON_COMMITTABLE_NUMERIC_INPUTS = new Set(['', '-', '+', '.', '-.', '+.']);

const isFiniteNumericInput = (value: string): value is string => {
    if (NON_COMMITTABLE_NUMERIC_INPUTS.has(value.trim())) {
        return false;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed);
};

export interface UseSlicePlaneReturn {
    distanceInput: string;
    normalInputs: Record<SlicePlaneNormalAxis, string>;
    reverseOrientation: boolean;
    visualizePlane: boolean;
    handleDistanceChange: (_fieldKey: string, value: string | number | boolean) => void;
    handleNormalChange: (axis: SlicePlaneNormalAxis) => (_fieldKey: string, value: string | number | boolean) => void;
    handleReverseOrientationChange: (_fieldKey: string, value: string | number | boolean) => void;
    handleVisualizePlaneChange: (_fieldKey: string, value: string | number | boolean) => void;
}

const useSlicePlane = (stageId: string, trajectoryId?: string): UseSlicePlaneReturn => {
    const stage = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined)?.find((entry) => entry.id === stageId)
    );
    const updateStageConfig = useCanvasPipelineStore((s) => s.updateStageConfig);

    const config = stage?.config as SlicePlaneStageConfig | undefined;
    const distance = config?.distance ?? 0;
    const normal = useMemo(
        () => config?.normal ?? { x: 1, y: 0, z: 0 },
        [config?.normal]
    );
    const reverseOrientation = config?.reverseOrientation ?? false;
    const visualizePlane = config?.visualizePlane ?? false;

    const [distanceInput, setDistanceInput] = useState(() => String(distance));
    const [normalInputs, setNormalInputs] = useState<Record<SlicePlaneNormalAxis, string>>(() => ({
        x: String(normal.x),
        y: String(normal.y),
        z: String(normal.z)
    }));

    useEffect(() => {
        setDistanceInput(String(distance));
    }, [distance]);

    useEffect(() => {
        setNormalInputs({ x: String(normal.x), y: String(normal.y), z: String(normal.z) });
    }, [normal.x, normal.y, normal.z]);

    const patch = useCallback((next: Partial<SlicePlaneStageConfig>) => {
        updateStageConfig(stageId, next as Partial<SlicePlaneStageConfig>, trajectoryId);
    }, [stageId, trajectoryId, updateStageConfig]);

    const handleDistanceChange = useCallback((_fieldKey: string, value: string | number | boolean) => {
        const nextValue = String(value);
        setDistanceInput(nextValue);
        if (!isFiniteNumericInput(nextValue)) return;
        patch({ distance: Number(nextValue) });
    }, [patch]);

    const handleNormalChange = useCallback((axis: SlicePlaneNormalAxis) => {
        return (_fieldKey: string, value: string | number | boolean) => {
            const nextValue = String(value);
            setNormalInputs((current) => ({ ...current, [axis]: nextValue }));
            if (!isFiniteNumericInput(nextValue)) return;
            patch({ normal: { ...normal, [axis]: Number(nextValue) } });
        };
    }, [normal, patch]);

    const handleReverseOrientationChange = useCallback((_fieldKey: string, value: string | number | boolean) => {
        patch({ reverseOrientation: Boolean(value) });
    }, [patch]);

    const handleVisualizePlaneChange = useCallback((_fieldKey: string, value: string | number | boolean) => {
        patch({ visualizePlane: Boolean(value) });
    }, [patch]);

    return {
        distanceInput,
        normalInputs,
        reverseOrientation,
        visualizePlane,
        handleDistanceChange,
        handleNormalChange,
        handleReverseOrientationChange,
        handleVisualizePlaneChange
    };
};

export default useSlicePlane;
