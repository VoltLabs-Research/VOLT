/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
