/**
 * Value Object representing a 3D position.
 * Pure domain type - no external dependencies.
 */
export interface Position3D {
    x: number;
    y: number;
    z: number;
}

/**
 * Creates a Position3D.
 */
export const createPosition3D = (x: number, y: number, z: number): Position3D => ({ x, y, z });

/**
 * Zero position constant.
 */
export const ZERO_POSITION: Position3D = { x: 0, y: 0, z: 0 };

/**
 * Adds two positions.
 */
export const addPositions = (a: Position3D, b: Position3D): Position3D => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
});

/**
 * Scales a position by a factor.
 */
export const scalePosition = (pos: Position3D, scale: number): Position3D => ({
    x: pos.x * scale,
    y: pos.y * scale,
    z: pos.z * scale
});

/**
 * Negates a position.
 */
export const negatePosition = (pos: Position3D): Position3D => ({
    x: -pos.x,
    y: -pos.y,
    z: -pos.z
});
