import { useMemo } from 'react';
import { Plane, Vector3 } from 'three';
import { SliceAxis } from '@/modules/fractal/types/configuration';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/types/configuration';

const AXIS_NORMALS: Record<SliceAxis, Vector3> = {
    [SliceAxis.X]: new Vector3(1, 0, 0),
    [SliceAxis.Y]: new Vector3(0, 1, 0),
    [SliceAxis.Z]: new Vector3(0, 0, 1),
};

const ROTATION_AXES: Record<SliceAxis, Vector3> = {
    [SliceAxis.X]: new Vector3(0, 0, 1),
    [SliceAxis.Y]: new Vector3(1, 0, 0),
    [SliceAxis.Z]: new Vector3(1, 0, 0),
};

const DEFAULT_BOUNDS: ModelWorldBounds = {
    min: {
        x: -4,
        y: -4,
        z: -4
    },
    max: {
        x: 4,
        y: 4,
        z: 4
    }
};

const useSlicingPlanes = (
    enableSlice: boolean,
    slicePlaneConfig: SlicePlaneConfig,
    modelWorldBounds?: ModelWorldBounds | null
): Plane[] => {
    return useMemo(() => {
        if (!enableSlice) return [];

        const { activeAxes, positions, angles } = slicePlaneConfig;

        if (activeAxes.length === 0) return [];

        const bounds = modelWorldBounds || DEFAULT_BOUNDS;
        const planes: Plane[] = [];

        for (const axis of activeAxes) {
            const baseNormal = AXIS_NORMALS[axis].clone().negate();
            const t = positions[axis];
            const angle = angles[axis] * (Math.PI / 180);

            const normal = baseNormal.applyAxisAngle(ROTATION_AXES[axis], angle);

            const maxVal = bounds.max[axis];
            const minVal = bounds.min[axis];
            const worldPos = maxVal - t * (maxVal - minVal);

            const coplanarPoint = AXIS_NORMALS[axis].clone().multiplyScalar(worldPos);

            const plane = new Plane();
            plane.setFromNormalAndCoplanarPoint(normal, coplanarPoint);
            planes.push(plane);
        }

        return planes;
    }, [enableSlice, slicePlaneConfig, modelWorldBounds]);
};

export default useSlicingPlanes;
