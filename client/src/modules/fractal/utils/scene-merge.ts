import { Box3, Vector3 } from 'three';
import type { Object3D } from 'three';

export const MERGE_OVERLAP_RATIO_THRESHOLD = 0.5;

export interface MergeCandidate {
    sceneKey: string;
    overlapRatio: number;
    snapDelta: Vector3;
}

const _size = new Vector3();
const _intersection = new Box3();
const _draggedCenter = new Vector3();

const getBoxVolume = (box: Box3): number => {
    if (box.isEmpty()) {
        return 0;
    }

    box.getSize(_size);
    return _size.x * _size.y * _size.z;
};

const markWorldMatrixChainDirty = (object: Object3D) => {
    let node: Object3D | null = object;

    while (node) {
        node.matrixWorldNeedsUpdate = true;
        node = node.parent;
    }
};

export const measureWorldCellBox = (
    object: Object3D,
    localBounds: Box3,
    target: Box3 = new Box3()
): Box3 => {
    markWorldMatrixChainDirty(object);
    object.updateWorldMatrix(true, false);

    return target.copy(localBounds).applyMatrix4(object.matrixWorld);
};

export const getCellOverlapRatio = (left: Box3, right: Box3): number => {
    const smallestVolume = Math.min(getBoxVolume(left), getBoxVolume(right));
    if (smallestVolume <= 0) {
        return 0;
    }

    _intersection.copy(left).intersect(right);
    return getBoxVolume(_intersection) / smallestVolume;
};

export const getCellSnapDelta = (fromBox: Box3, toBox: Box3): Vector3 => {
    fromBox.getCenter(_draggedCenter);
    return toBox.getCenter(new Vector3()).sub(_draggedCenter);
};

export const findMergeCandidate = (
    draggedBox: Box3,
    cellBoxes: ReadonlyMap<string, Box3>,
    threshold: number = MERGE_OVERLAP_RATIO_THRESHOLD
): MergeCandidate | null => {
    let candidate: MergeCandidate | null = null;

    for (const [sceneKey, cellBox] of cellBoxes) {
        const overlapRatio = getCellOverlapRatio(draggedBox, cellBox);
        if (overlapRatio < threshold) {
            continue;
        }

        if (candidate && candidate.overlapRatio >= overlapRatio) {
            continue;
        }

        candidate = {
            sceneKey,
            overlapRatio,
            snapDelta: getCellSnapDelta(draggedBox, cellBox)
        };
    }

    return candidate;
};

export const overlapsAnyCell = (
    box: Box3,
    cellBoxes: ReadonlyMap<string, Box3>,
    sceneKeys: Iterable<string>,
    threshold: number = MERGE_OVERLAP_RATIO_THRESHOLD
): boolean => {
    for (const sceneKey of sceneKeys) {
        const cellBox = cellBoxes.get(sceneKey);
        if (!cellBox) {
            continue;
        }

        if (getCellOverlapRatio(box, cellBox) >= threshold) {
            return true;
        }
    }

    return false;
};
