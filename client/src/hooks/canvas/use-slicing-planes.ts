/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
import useConfigurationStore from '@/stores/editor/configuration';

const EPS = 1e-6;

const useSlicingPlanes = (
    enableSlice: boolean,
): Plane[] => {
    const origin = useConfigurationStore((s) => s.slicingOrigin);
    const slicePlaneConfig = useConfigurationStore((s) => s.slicePlaneConfig);

    return useMemo(() => {
        if(!enableSlice) return [];

        const n = new Vector3(
            Number(slicePlaneConfig.normal.x) || 0,
            Number(slicePlaneConfig.normal.y) || 0,
            Number(slicePlaneConfig.normal.z) || 0
        );

        if(n.lengthSq() < EPS) return [];

        n.normalize();

        const p0 = new Vector3(origin.x || 0, origin.y || 0, origin.z || 0);
        const d = Number(slicePlaneConfig.distance) || 0;
        const w = Math.max(0, Number(slicePlaneConfig.slabWidth) || 0);

        if(w > EPS){
            const upper = d + w * 0.5;
            const lower = d - w * 0.5;

            const c1 = n.dot(p0) - upper;            
            const c2 = n.dot(p0) + lower;

            return [
                new Plane(n.clone(), c1),
                new Plane(n.clone().negate(), c2),
            ];
        }else{
            if(!slicePlaneConfig.reverseOrientation){
                const c = n.dot(p0) - d;           
                return [ new Plane(n, c) ];
            }else{
                const c = n.dot(p0) + d;
                return [ new Plane(n.clone().negate(), c) ];
            }
        }
    }, [enableSlice, slicePlaneConfig, origin]);
};

export default useSlicingPlanes;
