import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';

const areVectorsEqual = (
    left: ModelWorldBounds['min'],
    right: ModelWorldBounds['min']
): boolean => {
    return left.x === right.x
        && left.y === right.y
        && left.z === right.z;
};

/**
 * Compares world bounds by coordinate value so repeated derived emissions do not
 * trigger redundant viewer/store updates.
 */
export const areModelWorldBoundsEqual = (
    left: ModelWorldBounds | null,
    right: ModelWorldBounds | null
): boolean => {
    if (left === right) {
        return true;
    }

    if (!left || !right) {
        return false;
    }

    return areVectorsEqual(left.min, right.min)
        && areVectorsEqual(left.max, right.max);
};
