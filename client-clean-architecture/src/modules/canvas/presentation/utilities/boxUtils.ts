import type { BoxBounds } from '@/modules/canvas/presentation/types';

export interface BoxTransforms {
    scale: number;
    position: { x: number; y: number; z: number };
    center: { x: number; y: number; z: number };
    maxDimension: number;
};

export const calculateBoxTransforms = (boxBounds: BoxBounds): BoxTransforms => {
    const width = boxBounds.xhi - boxBounds.xlo;
    const height = boxBounds.yhi - boxBounds.ylo;
    const depth = boxBounds.zhi - boxBounds.zlo;

    const center = {
        x: (boxBounds.xlo + boxBounds.xhi) / 2,
        y: (boxBounds.ylo + boxBounds.yhi) / 2,
        z: (boxBounds.zlo + boxBounds.zhi) / 2
    };

    const maxDimension = Math.max(width, height, depth);

    const targetSize = 8;
    const scale = maxDimension > 0 ? targetSize / maxDimension : 1;

    const position = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale
    };

    return { scale, position, center, maxDimension };
};
