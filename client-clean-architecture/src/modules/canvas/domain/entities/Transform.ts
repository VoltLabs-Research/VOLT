import type { Position3D } from '../value-objects/Position3D';
import type { Rotation3D } from '../value-objects/Rotation3D';

/**
 * Domain entity representing a 3D transformation.
 * Combines position, rotation, and scale.
 */
export interface Transform {
    position: Position3D;
    rotation: Rotation3D;
    scale: number;
}

/**
 * Creates a default transform (identity).
 */
export const createDefaultTransform = (): Transform => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1
});
