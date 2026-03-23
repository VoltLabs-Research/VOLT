import { useMemo, useRef } from 'react';
import { Plane } from 'three';
import { resolveSlicePlaneDefinition } from '@/modules/fractal/utilities/slice-plane';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/types/configuration';

const useSlicingPlanes = (
    enableSlice: boolean,
    slicePlaneConfig: SlicePlaneConfig,
    _modelWorldBounds?: ModelWorldBounds | null
): Plane[] => {
    const planeRef = useRef(new Plane());
    const enabledPlanesRef = useRef<Plane[]>([planeRef.current]);
    const disabledPlanesRef = useRef<Plane[]>([]);

    return useMemo(() => {
        if (!enableSlice) {
            return disabledPlanesRef.current;
        }

        const slicePlane = resolveSlicePlaneDefinition(slicePlaneConfig);
        if (!slicePlane) {
            return disabledPlanesRef.current;
        }

        planeRef.current.copy(slicePlane.plane);
        return enabledPlanesRef.current;
    }, [enableSlice, slicePlaneConfig]);
};

export default useSlicingPlanes;
