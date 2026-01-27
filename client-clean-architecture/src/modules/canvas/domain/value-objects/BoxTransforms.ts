import type { Position3D } from './Position3D';

/**
 * Value Object representing computed transforms for a box.
 * Pure domain type - no external dependencies.
 */
export interface BoxTransforms {
    scale: number;
    position: Position3D;
    center: Position3D;
    maxDimension: number;
}
