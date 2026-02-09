import { useMemo } from 'react';
import { Plane, Vector3 } from 'three';
import type { SliceAxis, SlicePlaneConfig } from '@/modules/fractal/presentation/types/configuration';

const AXIS_NORMALS: Record<SliceAxis, Vector3> = {
    x: new Vector3(1, 0, 0),
    y: new Vector3(0, 1, 0),
    z: new Vector3(0, 0, 1),
};

const ROTATION_AXES: Record<SliceAxis, Vector3> = {
    x: new Vector3(0, 0, 1),
    y: new Vector3(1, 0, 0),
    z: new Vector3(1, 0, 0),
};

const useSlicingPlanes = (enableSlice: boolean, slicePlaneConfig: SlicePlaneConfig): Plane[] => {
    return useMemo(() => {
        if (!enableSlice) return [];

        const { activeAxes, positions, angles } = slicePlaneConfig;

        if (activeAxes.length === 0) return [];

        const planes: Plane[] = [];

        for (const axis of activeAxes) {
            const baseNormal = AXIS_NORMALS[axis].clone().negate();
            const position = positions[axis];
            const angle = angles[axis] * (Math.PI / 180);

            const normal = baseNormal.applyAxisAngle(ROTATION_AXES[axis], angle);

            const plane = new Plane();
            plane.setFromNormalAndCoplanarPoint(normal, normal.clone().multiplyScalar(position));
            planes.push(plane);
        }

        return planes;
    }, [enableSlice, slicePlaneConfig]);
};

export default useSlicingPlanes;
