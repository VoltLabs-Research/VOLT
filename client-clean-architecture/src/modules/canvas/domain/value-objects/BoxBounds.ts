/**
 * Value Object representing 3D box bounds.
 * Pure domain type - no external dependencies.
 */
export interface BoxBounds {
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

/**
 * Creates a BoxBounds from min/max coordinates.
 */
export const createBoxBounds = (
    xlo: number, xhi: number,
    ylo: number, yhi: number,
    zlo: number, zhi: number
): BoxBounds => ({ xlo, xhi, ylo, yhi, zlo, zhi });

/**
 * Calculates the dimensions of a box.
 */
export const getBoxDimensions = (bounds: BoxBounds) => ({
    width: bounds.xhi - bounds.xlo,
    height: bounds.yhi - bounds.ylo,
    depth: bounds.zhi - bounds.zlo
});

/**
 * Calculates the center point of a box.
 */
export const getBoxCenter = (bounds: BoxBounds) => ({
    x: (bounds.xlo + bounds.xhi) / 2,
    y: (bounds.ylo + bounds.yhi) / 2,
    z: (bounds.zlo + bounds.zhi) / 2
});
