import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '@/modules/canvas/store/editor';
import {
    selectIsSceneMergeFollower,
    selectSceneMergeGroupKeys
} from '@/modules/canvas/store/editor/selectors';
import { localModelDragBus } from '@/modules/canvas/collaboration/live-drag-bus';
import { useSceneMergePreviewStore } from '@/modules/fractal/store/scene-merge-preview-store';
import {
    getSceneCellBase,
    getSceneCellBases,
    registerSceneCellBase,
    unregisterSceneCellBase
} from '@/modules/fractal/services/scene-cell-registry';
import { findMergeCandidate, measureWorldCellBox, overlapsAnyCell } from '@/modules/fractal/utils/scene-merge';
import type { MergeCandidate } from '@/modules/fractal/utils/scene-merge';
import type { ModelDragOffset } from '@/modules/fractal/contracts/editor/scene-types';
import type { ModelDragPhase } from '@/modules/canvas/collaboration/live-drag-bus';

interface Vector3Ref {
    current: THREE.Vector3;
}

interface BooleanRef {
    current: boolean;
}

interface GroupRef {
    current: THREE.Group | null;
}

interface UseSceneMergeParams {
    sceneKey: string;
    contentRef: GroupRef;
    boxGeometry: THREE.BufferGeometry | null;
    currentDragPosRef: Vector3Ref;
    isDraggingRef: BooleanRef;
    onGroupDragDelta: (delta: ModelDragOffset, phase: ModelDragPhase) => void;
}

const ZERO_DRAG_OFFSET: ModelDragOffset = {
    x: 0,
    y: 0,
    z: 0
};

const _measuredBox = new THREE.Box3();
const _prospectiveBox = new THREE.Box3();
const _offsetVector = new THREE.Vector3();
const _emitDelta = new THREE.Vector3();

const useSceneMerge = ({
    sceneKey,
    contentRef,
    boxGeometry,
    currentDragPosRef,
    isDraggingRef,
    onGroupDragDelta
}: UseSceneMergeParams) => {
    const isMergeFollower = useEditorStore((state) => selectIsSceneMergeFollower(state, sceneKey));
    const isMergeHighlighted = useSceneMergePreviewStore((state) => (
        state.candidateSceneKey !== null
        && (state.candidateSceneKey === sceneKey || state.draggedSceneKey === sceneKey)
    ));
    const setMergePreview = useSceneMergePreviewStore((state) => state.setMergePreview);
    const clearMergePreview = useSceneMergePreviewStore((state) => state.clearMergePreview);

    const dragBaselineBoxRef = useRef(new THREE.Box3());
    const lastEmittedPositionRef = useRef(new THREE.Vector3());
    const mergeCandidateRef = useRef<MergeCandidate | null>(null);

    const syncCellRegistration = useCallback(() => {
        const content = contentRef.current;
        if (!content || !boxGeometry) {
            unregisterSceneCellBase(sceneKey);
            return;
        }

        if (!boxGeometry.boundingBox) {
            boxGeometry.computeBoundingBox();
        }

        const localBounds = boxGeometry.boundingBox;
        if (!localBounds) {
            return;
        }

        measureWorldCellBox(content, localBounds, _measuredBox);
        _measuredBox.translate(_offsetVector.copy(currentDragPosRef.current).negate());
        registerSceneCellBase(sceneKey, _measuredBox);
    }, [boxGeometry, contentRef, currentDragPosRef, sceneKey]);

    useEffect(() => {
        return () => unregisterSceneCellBase(sceneKey);
    }, [sceneKey]);

    const buildComparableCellBoxes = useCallback((excludedKeys: Set<string>) => {
        const { modelDragOffsets } = useEditorStore.getState();
        const comparableCellBoxes = new Map<string, THREE.Box3>();

        for (const [key, baseBox] of getSceneCellBases()) {
            if (excludedKeys.has(key)) {
                continue;
            }

            const offset = modelDragOffsets[key] ?? ZERO_DRAG_OFFSET;
            comparableCellBoxes.set(
                key,
                baseBox.clone().translate(_offsetVector.set(offset.x, offset.y, offset.z))
            );
        }

        return comparableCellBoxes;
    }, []);

    const emitGroupDrag = useCallback((position: THREE.Vector3, phase: ModelDragPhase) => {
        _emitDelta.copy(position).sub(lastEmittedPositionRef.current);
        lastEmittedPositionRef.current.copy(position);

        localModelDragBus.emit({
            sceneKey,
            offset: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            delta: {
                x: _emitDelta.x,
                y: _emitDelta.y,
                z: _emitDelta.z
            },
            phase
        });
    }, [sceneKey]);

    const beginMergeDrag = useCallback((shouldExtractFromGroup: boolean) => {
        if (shouldExtractFromGroup) {
            useEditorStore.getState().unmergeScene(sceneKey);
        }

        const baseBox = getSceneCellBase(sceneKey);
        if (baseBox) {
            dragBaselineBoxRef.current.copy(baseBox);
        } else {
            dragBaselineBoxRef.current.makeEmpty();
        }

        lastEmittedPositionRef.current.copy(currentDragPosRef.current);
        mergeCandidateRef.current = null;
    }, [currentDragPosRef, sceneKey]);

    const updateMergeDrag = useCallback((nextPosition: THREE.Vector3) => {
        emitGroupDrag(nextPosition, 'move');

        if (dragBaselineBoxRef.current.isEmpty()) {
            return;
        }

        const groupKeys = selectSceneMergeGroupKeys(useEditorStore.getState(), sceneKey);
        _prospectiveBox.copy(dragBaselineBoxRef.current).translate(nextPosition);

        const candidate = findMergeCandidate(
            _prospectiveBox,
            buildComparableCellBoxes(new Set([sceneKey, ...groupKeys]))
        );

        mergeCandidateRef.current = candidate;
        setMergePreview(sceneKey, candidate?.sceneKey ?? null);
    }, [buildComparableCellBoxes, emitGroupDrag, sceneKey, setMergePreview]);

    const commitMergeDrag = useCallback((dropPosition: THREE.Vector3): THREE.Vector3 => {
        const candidate = mergeCandidateRef.current;
        mergeCandidateRef.current = null;
        clearMergePreview();

        const finalPosition = dropPosition.clone();
        if (candidate) {
            finalPosition.add(candidate.snapDelta);
            finalPosition.z = Math.max(0, finalPosition.z);
        }

        emitGroupDrag(finalPosition, 'end');

        const store = useEditorStore.getState();
        if (candidate) {
            store.mergeScenes([sceneKey, candidate.sceneKey]);
            return finalPosition;
        }

        const groupKeys = selectSceneMergeGroupKeys(store, sceneKey)
            .filter((key) => key !== sceneKey);
        if (groupKeys.length === 0 || dragBaselineBoxRef.current.isEmpty()) {
            return finalPosition;
        }

        _prospectiveBox.copy(dragBaselineBoxRef.current).translate(finalPosition);
        const stillOverlapsGroup = overlapsAnyCell(
            _prospectiveBox,
            buildComparableCellBoxes(new Set([sceneKey])),
            groupKeys
        );

        if (!stillOverlapsGroup) {
            store.unmergeScene(sceneKey);
        }

        return finalPosition;
    }, [buildComparableCellBoxes, clearMergePreview, emitGroupDrag, sceneKey]);

    useEffect(() => {
        return localModelDragBus.on((event) => {
            if (event.sceneKey === sceneKey || !event.delta) {
                return;
            }

            if (isDraggingRef.current) {
                return;
            }

            const groupKeys = selectSceneMergeGroupKeys(useEditorStore.getState(), sceneKey);
            if (!groupKeys.includes(event.sceneKey)) {
                return;
            }

            onGroupDragDelta(event.delta, event.phase ?? 'move');
        });
    }, [isDraggingRef, onGroupDragDelta, sceneKey]);

    return {
        isMergeFollower,
        isMergeHighlighted,
        syncCellRegistration,
        beginMergeDrag,
        updateMergeDrag,
        commitMergeDrag
    };
};

export default useSceneMerge;
