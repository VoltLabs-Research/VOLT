import type { Position3D } from './Position3D';
import type { Rotation3D } from './Rotation3D';

/**
 * Value Object representing optimal transforms for rendering a model.
 * Pure domain type - no external dependencies.
 */
export interface OptimalTransforms {
    position: Position3D;
    rotation: Rotation3D;
    scale: number;
}
