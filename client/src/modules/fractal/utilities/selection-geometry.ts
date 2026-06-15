import type { SelectionBox, SelectionLasso } from '@/modules/fractal/types/scene-config';

/**
 * Pure screen-space selection geometry helpers. No Three.js, no DOM — every
 * function is a deterministic predicate over CSS-pixel coordinates so it can be
 * unit-tested and shared between the engine projection pass and the canvas
 * pointer hook.
 */

// Ray-casting (even-odd) point-in-polygon. Robust for the simple, possibly
// self-intersecting freehand lassos a user draws; O(n) in the vertex count.
export const isPointInLasso = (x: number, y: number, lasso: SelectionLasso): boolean => {
    const points = lasso.points;
    const count = points.length;
    if (count < 3) return false;

    let inside = false;
    for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        const intersects = (yi > y) !== (yj > y)
            && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
};

export const isPointInBox = (x: number, y: number, box: SelectionBox): boolean => (
    x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY
);

// Normalizes two drag corners into a min/max box regardless of drag direction.
export const boxFromCorners = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
): SelectionBox => ({
    minX: Math.min(startX, endX),
    minY: Math.min(startY, endY),
    maxX: Math.max(startX, endX),
    maxY: Math.max(startY, endY)
});

// Axis-aligned bounding box of a lasso path — a cheap broad-phase reject before
// the per-point ray cast when testing many atoms against one lasso.
export const lassoBounds = (lasso: SelectionLasso): SelectionBox | null => {
    if (lasso.points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of lasso.points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY };
};
