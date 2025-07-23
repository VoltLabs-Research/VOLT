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