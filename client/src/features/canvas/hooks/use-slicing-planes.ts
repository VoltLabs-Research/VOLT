import { useMemo } from 'react';
import { Plane, Vector3 } from 'three';
import { useEditorStore } from '@/features/canvas/stores/editor';
import type { SliceAxis } from '@/types/stores/editor/configuration';

const AXIS_NORMALS: Record<SliceAxis, Vector3> = {
    x: new Vector3(1, 0, 0),
    y: new Vector3(0, 1, 0),
    z: new Vector3(0, 0, 1),
};

const useSlicingPlanes = (enableSlice: boolean): Plane[] => {
    const slicePlaneConfig = useEditorStore((s) => s.configuration.slicePlaneConfig);

    return useMemo(() => {
        if (!enableSlice) return [];

        const { activeAxes, positions, angles } = slicePlaneConfig;

        if (activeAxes.length === 0) return [];

        const planes: Plane[] = [];

        for (const axis of activeAxes) {
            const baseNormal = AXIS_NORMALS[axis].clone().negate();
            const position = positions[axis];
            const angle = angles[axis] * (Math.PI / 180);

            // Rotate the normal around a perpendicular axis
            let rotationAxis: Vector3;
            if (axis === 'x') {
                rotationAxis = new Vector3(0, 0, 1);
            } else if (axis === 'y') {
                rotationAxis = new Vector3(1, 0, 0);
            } else {
                rotationAxis = new Vector3(1, 0, 0);
            }

            const normal = baseNormal.applyAxisAngle(rotationAxis, angle);

            planes.push(new Plane(normal, position));
        }

        return planes;
    }, [enableSlice, slicePlaneConfig]);
};

export default useSlicingPlanes;
