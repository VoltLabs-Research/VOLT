import type { BoxBounds } from '@/modules/fractal/api/entities/model';

export interface BoxTransforms {
    scale: number;
    position: { x: number; y: number; z: number };
    center: { x: number; y: number; z: number };
    maxDimension: number;
}

export interface BoxDimensions {
    width: number;
    height: number;
    depth: number;
    center: { x: number; y: number; z: number };
}

export const getBoxDimensions = (boxBounds: BoxBounds): BoxDimensions => {
    const width = boxBounds.xhi - boxBounds.xlo;
    const height = boxBounds.yhi - boxBounds.ylo;
    const depth = boxBounds.zhi - boxBounds.zlo;
    const center = {
        x: (boxBounds.xlo + boxBounds.xhi) / 2,
        y: (boxBounds.ylo + boxBounds.yhi) / 2,
        z: (boxBounds.zlo + boxBounds.zhi) / 2
    };
    return {
        width,
        height,
        depth,
        center
    };
};

export const calculateBoxTransforms = (boxBounds: BoxBounds): BoxTransforms => {
    const { width, height, depth, center } = getBoxDimensions(boxBounds);

    const maxDimension = Math.max(width, height, depth);

    const targetSize = 8;
    let scale = 1;
    if (maxDimension > 0) {
        scale = targetSize / maxDimension;
    }

    const position = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale
    };

    return {
        scale,
        position,
        center,
        maxDimension
    };
};

export const getGroundOffset = (boxBounds?: BoxBounds, transforms?: BoxTransforms) => {
    if (!boxBounds || !transforms) return 0;
    const minZWorld = (boxBounds.zlo * transforms.scale) + transforms.position.z;
    return -minZWorld;
};

export const buildCellBoxTransforms = (transforms?: BoxTransforms, groundOffset = 0) => {
    if (!transforms) return undefined;
    return {
        scale: transforms.scale,
        // Pass through the centering position so the model is centered at the
        // origin (matching the old version's behaviour).  The groundOffset was
        // already computed assuming this centering is applied — zeroing the
        // position broke the math and caused models to float above the grid.
        position: {
            x: transforms.position.x,
            y: transforms.position.y,
            z: transforms.position.z
        },
        groundOffset
    };
};
