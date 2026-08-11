import useStageConfig from '@/modules/canvas/hooks/use-stage-config';
import { parseNumericInput } from '@/modules/canvas/utils/parse-numeric-input';

import { useEffect, useMemo, useState } from 'react';
import type { SlicePlaneNormalAxis } from '@/modules/fractal/contracts/scene';
import type { SlicePlaneStageConfig } from '@/modules/canvas/store/canvas-pipeline';

type FieldChangeHandler = (fieldKey: string, value: string | number | boolean) => void;

const useSlicePlane = (stageId: string, trajectoryId?: string) => {
    const { config, patch } = useStageConfig<SlicePlaneStageConfig>(stageId, trajectoryId);

    const distance = config?.distance ?? 0;
    const normal = useMemo(
        () => config?.normal ?? {
            x: 1,
            y: 0,
            z: 0
        },
        [config?.normal]
    );

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
        setNormalInputs({
            x: String(normal.x),
            y: String(normal.y),
            z: String(normal.z)
        });
    }, [normal.x, normal.y, normal.z]);

    const handleDistanceChange: FieldChangeHandler = (_fieldKey, value) => {
        const nextValue = String(value);
        setDistanceInput(nextValue);

        const parsed = parseNumericInput(nextValue);
        if (parsed === null) return;
        patch({ distance: parsed });
    };

    const handleNormalChange = (axis: SlicePlaneNormalAxis): FieldChangeHandler => {
        return (_fieldKey, value) => {
            const nextValue = String(value);
            setNormalInputs((current) => ({
                ...current,
                [axis]: nextValue
            }));

            const parsed = parseNumericInput(nextValue);
            if (parsed === null) return;
            patch({
                normal: {
                    ...normal,
                    [axis]: parsed
                }
            });
        };
    };

    return {
        distanceInput,
        normalInputs,
        reverseOrientation: config?.reverseOrientation ?? false,
        visualizePlane: config?.visualizePlane ?? false,
        handleDistanceChange,
        handleNormalChange,
        handleReverseOrientationChange: ((_fieldKey, value) => {
            patch({ reverseOrientation: Boolean(value) });
        }) satisfies FieldChangeHandler,
        handleVisualizePlaneChange: ((_fieldKey, value) => {
            patch({ visualizePlane: Boolean(value) });
        }) satisfies FieldChangeHandler
    };
};

export default useSlicePlane;
