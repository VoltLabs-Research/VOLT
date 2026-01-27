import type { Position3D } from './Position3D';

/**
 * Value Object representing model bounds computed from 3D geometry.
 * Pure domain type - no external dependencies.
 */
export interface ModelBounds {
    /** Size in each dimension */
    size: Position3D;
    /** Center point */
    center: Position3D;
    /** Maximum dimension (for normalization) */
    maxDimension: number;
    /** Bounding sphere radius */
    sphereRadius: number;
}

/**
 * Creates ModelBounds from size and center.
 */
export const createModelBounds = (
    size: Position3D,
    center: Position3D,
    sphereRadius?: number
): ModelBounds => ({
    size,
    center,
    maxDimension: Math.max(size.x, size.y, size.z),
    sphereRadius: sphereRadius ?? Math.max(size.x, size.y, size.z) / 2
});
