/**
 * Value Object representing a 3D rotation in radians.
 * Pure domain type - no external dependencies.
 */
export interface Rotation3D {
    x: number;
    y: number;
    z: number;
}

/**
 * Creates a Rotation3D.
 */
export const createRotation3D = (x: number, y: number, z: number): Rotation3D => ({ x, y, z });

/**
 * Zero rotation constant.
 */
export const ZERO_ROTATION: Rotation3D = { x: 0, y: 0, z: 0 };

/**
 * Rotation of 90 degrees around X axis.
 */
export const ROTATION_90_X: Rotation3D = { x: Math.PI / 2, y: 0, z: 0 };

/**
 * Adds two rotations.
 */
export const addRotations = (a: Rotation3D, b: Rotation3D): Rotation3D => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
});
