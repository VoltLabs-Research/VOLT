import type { BoxBounds } from '../value-objects/BoxBounds';
import type { BoxTransforms } from '../value-objects/BoxTransforms';
import type { ModelBounds } from '../value-objects/ModelBounds';
import type { OptimalTransforms } from '../value-objects/OptimalTransforms';
import type { Position3D } from '../value-objects/Position3D';
import { ZERO_ROTATION, ROTATION_90_X } from '../value-objects/Rotation3D';
import type { ViewFace } from '../value-objects/ViewFace';
import { VIEW_FACES } from '../value-objects/ViewFace';

/**
 * Target size for model normalization (in scene units).
 */
const TARGET_SIZE = 8;

/**
 * Calculates transforms for a simulation box.
 * Pure function - deterministic, no side effects.
 */
export const calculateBoxTransforms = (boxBounds: BoxBounds): BoxTransforms => {
    const width = boxBounds.xhi - boxBounds.xlo;
    const height = boxBounds.yhi - boxBounds.ylo;
    const depth = boxBounds.zhi - boxBounds.zlo;

    const center: Position3D = {
        x: (boxBounds.xlo + boxBounds.xhi) / 2,
        y: (boxBounds.ylo + boxBounds.yhi) / 2,
        z: (boxBounds.zlo + boxBounds.zhi) / 2
    };

    const maxDimension = Math.max(width, height, depth);
    const scale = maxDimension > 0 ? TARGET_SIZE / maxDimension : 1;

    const position: Position3D = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale
    };

    return { scale, position, center, maxDimension };
};

/**
 * Calculates optimal transforms for rendering a model.
 */
export const calculateOptimalTransforms = (bounds: ModelBounds): OptimalTransforms => {
    const { size, center, maxDimension } = bounds;

    const scale = maxDimension > 0 ? TARGET_SIZE / maxDimension : 1;

    const shouldRotate = size.y > size.z * 1.2 || size.z < Math.min(size.x, size.y) * 0.8;
    const rotation = shouldRotate ? ROTATION_90_X : ZERO_ROTATION;

    const position: Position3D = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale
    };

    return { position, rotation, scale };
};

/**
 * Calculates the optimal camera distance for viewing a model.
 */
export const calculateOptimalCameraDistance = (
    viewHeight: number,
    viewWidth: number,
    fovDegrees: number,
    aspectRatio: number
): number => {
    const fovRad = (fovDegrees * Math.PI) / 180;
    const distByHeight = (viewHeight / 2) / Math.tan(fovRad / 2);
    const distByWidth = (viewWidth / 2) / (Math.tan(fovRad / 2) * aspectRatio);

    return Math.max(distByHeight, distByWidth) * 1.01;
};

/**
 * Calculates the camera position for a specific view face.
 */
export const calculateCameraPositionForFace = (
    center: Position3D,
    size: Position3D,
    face: ViewFace,
    fovDegrees: number,
    aspectRatio: number,
    padding: number = 1.2
): { position: Position3D; target: Position3D; up: Position3D } => {
    const { normal, up } = VIEW_FACES[face];
    
    // Determine view dimensions based on face
    let viewHeight: number;
    let viewWidth: number;
    
    if (face === 'px' || face === 'nx') {
        viewHeight = size.z;
        viewWidth = size.y;
    } else if (face === 'py' || face === 'ny') {
        viewHeight = size.z;
        viewWidth = size.x;
    } else {
        viewHeight = size.y;
        viewWidth = size.x;
    }

    const distance = calculateOptimalCameraDistance(viewHeight, viewWidth, fovDegrees, aspectRatio) * padding;

    return {
        position: {
            x: center.x + normal.x * distance,
            y: center.y + normal.y * distance,
            z: center.z + normal.z * distance
        },
        target: { ...center },
        up: { ...up }
    };
};
