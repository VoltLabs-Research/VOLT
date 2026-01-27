import type { Position3D } from '../value-objects/Position3D';

/**
 * Enumeration of available standard views/faces.
 */
export type ViewFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

/**
 * Metadata for a view face.
 */
export interface ViewFaceInfo {
    normal: Position3D;
    up: Position3D;
}

/**
 * Map of view face metadata.
 */
export const VIEW_FACES: Record<ViewFace, ViewFaceInfo> = {
    px: { normal: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } },
    nx: { normal: { x: -1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } },
    py: { normal: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 } },
    ny: { normal: { x: 0, y: -1, z: 0 }, up: { x: 0, y: 0, z: 1 } },
    pz: { normal: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 } },
    nz: { normal: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } },
};
