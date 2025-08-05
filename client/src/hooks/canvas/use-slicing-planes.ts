/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import { useMemo } from 'react';
import { Plane, Vector3 } from 'three';
import type { SlicePlaneConfig } from '@/stores/editor';

const useSlicingPlanes = (
    enableSlice: boolean,
    slicePlaneConfig: SlicePlaneConfig
): Plane[] => {

    const sliceClippingPlanes = useMemo(() => {
        if(!enableSlice){
            return [];
        }

        const planes: Plane[] = [];
        const { normal: normalConfig, distance, slabWidth, reverseOrientation } = slicePlaneConfig;
        const normal = new Vector3(normalConfig.x, normalConfig.y, normalConfig.z);

        if(normal.lengthSq() > 0.001){
            normal.normalize();
        }

        const plane1 = new Plane(normal.clone(), -distance);

        if(slabWidth && slabWidth > 0){
            planes.push(plane1);
            const plane2Distance = distance + slabWidth;
            const plane2 = new Plane(normal.clone().negate(), plane2Distance);
            planes.push(plane2);
        }else{
            planes.push(reverseOrientation ? new Plane(normal.clone().negate(), distance) : plane1);
        }

        return planes;
    }, [enableSlice, slicePlaneConfig]);

    return sliceClippingPlanes;
};

export default useSlicingPlanes;