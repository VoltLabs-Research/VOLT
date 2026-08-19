import { DragControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { BoxBounds } from '@volt/contracts/modules/trajectory/domain';
import { getBoxDimensions } from '@/modules/fractal/utils/box-utils';
import {
    buildAabbWireframeGeometry,
    buildCellWireframeGeometry,
    hasValidCellVectors
} from '@/modules/fractal/utils/cell-wireframe';
import type { CellPbc } from '@/modules/fractal/utils/cell-wireframe';
import { FLOOR_AXIS_LOCK, useKeyboardDragModifiers } from '@/modules/fractal/components/molecules/SimulationCellBox/use-keyboard-drag-modifiers';
import { useTouchDragArming } from '@/modules/fractal/components/molecules/SimulationCellBox/use-touch-drag-arming';
import useSceneMerge from '@/modules/fractal/components/molecules/SimulationCellBox/use-scene-merge';
import { Theme } from '@/shared/ui/hooks/use-theme';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/ui/utils/app-theme';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, useEffect, forwardRef, useState, useCallback } from 'react';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { remoteModelDragBus } from '@/modules/canvas/collaboration/live-drag-bus';
import type { ModelDragPhase } from '@/modules/canvas/collaboration/live-drag-bus';
import type { ModelDragOffset } from '@/modules/fractal/contracts/editor/scene-types';
import type { Pos3D } from '@/modules/fractal/contracts/model';
import type { ReactNode, RefObject } from 'react';

interface SimulationCellGeometryView {
    cellVectors?: number[][];
    cellOrigin?: number[];
    pbc?: CellPbc;
    showPbcImages?: boolean;
}

export interface SimulationCellTransforms {
    scale: number;
    position: Pos3D;
    groundOffset?: number;
}

interface SimulationCellBoxProps {
    sceneKey: string;
    boxBounds?: BoxBounds;
    cellGeometry?: SimulationCellGeometryView;
    children?: ReactNode;
    transforms?: SimulationCellTransforms;
    orbitControlsRef?: RefObject<{ enabled: boolean } | null>;
    onSelect?: (target: THREE.Group | null) => void;
    onHoverChange?: (hovered: boolean) => void;
}

const _decomposePos = new THREE.Vector3();
const _decomposeQuat = new THREE.Quaternion();
const _decomposeScale = new THREE.Vector3();
const _clampedPos = new THREE.Vector3();
const _groupDragPos = new THREE.Vector3();
const _identityQuat = new THREE.Quaternion();
const _unitScale = new THREE.Vector3(1, 1, 1);

const MERGE_HIGHLIGHT_WIREFRAME_COLOR = '#fbbf24';
const MERGE_HIGHLIGHT_WIREFRAME_OPACITY = 0.85;

const ZERO_OFFSET = {
    x: 0,
    y: 0,
    z: 0
} as const;

const SimulationCellBox = forwardRef<THREE.Mesh, SimulationCellBoxProps>(({
    sceneKey,
    boxBounds,
    cellGeometry,
    children,
    transforms,
    orbitControlsRef,
    onSelect,
    onHoverChange
}, ref) => {
    const invalidate = useThree((state) => state.invalidate);
    const camera = useThree((state) => state.camera);
    const dragRef = useRef<THREE.Group>(null!);
    const contentRef = useRef<THREE.Group>(null!);
    const isDraggingRef = useRef(false);
    const dragMatrixRef = useRef(new THREE.Matrix4());
    const currentDragPosRef = useRef(new THREE.Vector3());
    const targetDragPosRef = useRef(new THREE.Vector3());
    const dragStartPosRef = useRef(new THREE.Vector3());
    const shouldExtractOnDragRef = useRef(false);
    const showSimulationCell = useEditorStore((state) => state.showSimulationCell);
    const modelDragOffset = useEditorStore((state) => state.modelDragOffsets[sceneKey] ?? ZERO_OFFSET);
    const setModelDragOffsetForScene = useEditorStore((state) => state.setModelDragOffsetForScene);
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());
    const [isDesktopDragSessionActive, setIsDesktopDragSessionActive] = useState(false);
    const isMobileViewport = useMedia('(max-width: 768px)');
    const suppressCurrentTouchDragRef = useRef(false);
    const { axisLock, axisLockRef, isModifierActive } = useKeyboardDragModifiers(camera, isMobileViewport);
    const touchDrag = useTouchDragArming(isMobileViewport);
    const isLightTheme = theme === Theme.Light;

    useEffect(() => {
        return subscribeToAppTheme(setTheme);
    }, []);

    const setOrbitControlsEnabled = useCallback((enabled: boolean) => {
        if (orbitControlsRef?.current) {
            orbitControlsRef.current.enabled = enabled;
        }
    }, [orbitControlsRef]);

    const geometry = useMemo(() => {
        if (cellGeometry?.cellVectors && hasValidCellVectors(cellGeometry.cellVectors)) {
            return buildCellWireframeGeometry(
                cellGeometry.cellVectors,
                cellGeometry.cellOrigin,
                {
                    pbc: cellGeometry.pbc,
                    showPbcImages: cellGeometry.showPbcImages
                }
            );
        }

        if (!boxBounds) return null;
        return buildAabbWireframeGeometry(boxBounds);
    }, [boxBounds, cellGeometry]);

    const boxGeometry = useMemo(() => {
        if (!boxBounds) return null;
        const { width, height, depth, center } = getBoxDimensions(boxBounds);

        const geo = new THREE.BoxGeometry(width, height, depth);
        geo.translate(center.x, center.y, center.z);
        return geo;
    }, [boxBounds]);

    const applyGroupDragDelta = useCallback((delta: ModelDragOffset, phase: ModelDragPhase) => {
        const basePosition = phase === 'end' ? targetDragPosRef.current : currentDragPosRef.current;
        _groupDragPos.set(
            basePosition.x + delta.x,
            basePosition.y + delta.y,
            Math.max(0, basePosition.z + delta.z)
        );
        targetDragPosRef.current.copy(_groupDragPos);

        if (phase === 'end') {
            setModelDragOffsetForScene(sceneKey, {
                x: _groupDragPos.x,
                y: _groupDragPos.y,
                z: _groupDragPos.z
            });
            invalidate();
            return;
        }

        currentDragPosRef.current.copy(_groupDragPos);
        dragMatrixRef.current.compose(_groupDragPos, _identityQuat, _unitScale);

        if (dragRef.current) {
            dragRef.current.matrix.copy(dragMatrixRef.current);
            dragRef.current.matrixWorldNeedsUpdate = true;
        }

        invalidate();
    }, [invalidate, sceneKey, setModelDragOffsetForScene]);

    const {
        isMergeFollower,
        isMergeHighlighted,
        syncCellRegistration,
        beginMergeDrag,
        updateMergeDrag,
        commitMergeDrag
    } = useSceneMerge({
        sceneKey,
        contentRef,
        boxGeometry,
        currentDragPosRef,
        isDraggingRef,
        onGroupDragDelta: applyGroupDragDelta
    });

    useEffect(() => {
        const target = contentRef.current;
        if (!target) return;

        if (transforms) {
            target.position.set(
                transforms.position.x,
                transforms.position.y,
                transforms.position.z + (transforms.groundOffset || 0)
            );
            const s = transforms.scale || 1;
            target.scale.set(s, s, s);
        } else {
            target.position.set(0, 0, 0);
            target.scale.set(1, 1, 1);
        }

        syncCellRegistration();
    }, [syncCellRegistration, transforms]);

    useEffect(() => {
        if (isDraggingRef.current) return;

        const offset = useEditorStore.getState().modelDragOffsets[sceneKey] ?? ZERO_OFFSET;
        currentDragPosRef.current.set(offset.x, offset.y, offset.z);
        targetDragPosRef.current.copy(currentDragPosRef.current);
        dragMatrixRef.current.compose(currentDragPosRef.current, _identityQuat, _unitScale);

        if (dragRef.current) {
            dragRef.current.matrix.copy(dragMatrixRef.current);
            dragRef.current.matrixWorldNeedsUpdate = true;
        }
        syncCellRegistration();
        invalidate();
    }, [boxBounds, transforms, invalidate, sceneKey, syncCellRegistration]);

    useEffect(() => {
        if (isDraggingRef.current) return;
        targetDragPosRef.current.set(modelDragOffset.x, modelDragOffset.y, modelDragOffset.z);
        invalidate();
    }, [modelDragOffset, invalidate]);

    useEffect(() => {
        invalidate();
    }, [invalidate, isMergeFollower, isMergeHighlighted]);

    useEffect(() => {
        return remoteModelDragBus.on((event) => {
            if (event.sceneKey !== sceneKey) return;
            if (isDraggingRef.current) return;
            targetDragPosRef.current.set(event.offset.x, event.offset.y, event.offset.z);
            invalidate();
        });
    }, [invalidate, sceneKey]);

    useFrame((_, delta) => {
        if (isDraggingRef.current) return;

        const current = currentDragPosRef.current;
        const target = targetDragPosRef.current;
        if (current.distanceToSquared(target) < 1e-6) return;

        const alpha = 1 - Math.exp(-18 * delta);
        current.lerp(target, alpha);

        dragMatrixRef.current.compose(current, _identityQuat, _unitScale);
        if (dragRef.current) {
            dragRef.current.matrix.copy(dragMatrixRef.current);
            dragRef.current.matrixWorldNeedsUpdate = true;
        }
        invalidate();
    });

    useEffect(() => () => {
        geometry?.dispose();
    }, [geometry]);

    useEffect(() => () => {
        boxGeometry?.dispose();
    }, [boxGeometry]);

    const handleContentPointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
        shouldExtractOnDragRef.current = event.shiftKey;
        touchDrag.handlePointerDown(event);
    }, [touchDrag]);

    if (!boxBounds || !geometry) {
        return <group ref={contentRef}>{children}</group>;
    }

    return (
        <DragControls
            ref={dragRef}
            autoTransform={false}
            axisLock={axisLock}
            matrix={dragMatrixRef.current}
            dragConfig={isMobileViewport
                ? undefined
                : {
                    enabled: isModifierActive || isDesktopDragSessionActive
                }}
            dragLimits={[
                undefined,
                undefined,
                [0, Number.POSITIVE_INFINITY]
            ]}
            onHover={onHoverChange}
            onDragStart={() => {
                const isTouchGesture = touchDrag.isTouchGesture();
                if (isTouchGesture && !touchDrag.consumeArming()) {
                    suppressCurrentTouchDragRef.current = true;
                    setOrbitControlsEnabled(true);
                    return;
                }

                suppressCurrentTouchDragRef.current = false;
                isDraggingRef.current = true;
                if (!isTouchGesture) {
                    setIsDesktopDragSessionActive(true);
                }
                dragStartPosRef.current.copy(currentDragPosRef.current);
                beginMergeDrag(shouldExtractOnDragRef.current);
                onSelect?.(contentRef.current);
                setOrbitControlsEnabled(false);
            }}
            onDrag={(localMatrix: THREE.Matrix4) => {
                if (suppressCurrentTouchDragRef.current) {
                    return;
                }

                localMatrix.decompose(_decomposePos, _decomposeQuat, _decomposeScale);
                if (axisLockRef.current === FLOOR_AXIS_LOCK) {
                    _clampedPos.set(_decomposePos.x, _decomposePos.y, Math.max(0, _decomposePos.z));
                } else {
                    _clampedPos.set(
                        dragStartPosRef.current.x,
                        dragStartPosRef.current.y,
                        Math.max(0, _decomposePos.z)
                    );
                }

                dragMatrixRef.current.compose(_clampedPos, _decomposeQuat, _decomposeScale);

                if (dragRef.current) {
                    dragRef.current.matrix.copy(dragMatrixRef.current);
                    dragRef.current.matrixWorldNeedsUpdate = true;
                }
                currentDragPosRef.current.copy(_clampedPos);
                targetDragPosRef.current.copy(_clampedPos);
                updateMergeDrag(_clampedPos);
                invalidate();
            }}
            onDragEnd={() => {
                if (suppressCurrentTouchDragRef.current) {
                    suppressCurrentTouchDragRef.current = false;
                    setOrbitControlsEnabled(true);
                    return;
                }

                isDraggingRef.current = false;
                setIsDesktopDragSessionActive(false);
                dragMatrixRef.current.decompose(_decomposePos, _decomposeQuat, _decomposeScale);
                currentDragPosRef.current.copy(_decomposePos);

                const finalPosition = commitMergeDrag(_decomposePos);
                targetDragPosRef.current.copy(finalPosition);
                setModelDragOffsetForScene(sceneKey, {
                    x: finalPosition.x,
                    y: finalPosition.y,
                    z: finalPosition.z
                });
                invalidate();
                setOrbitControlsEnabled(true);
            }}
        >
            <group
                ref={contentRef}
                onPointerDown={handleContentPointerDown}
                onClick={(event: ThreeEvent<MouseEvent>) => {
                    if (isDraggingRef.current) {
                        return;
                    }

                    event.stopPropagation();
                    onSelect?.(contentRef.current);
                }}
            >
                {showSimulationCell && boxGeometry && (
                    <mesh
                        ref={ref}
                        geometry={boxGeometry}
                        userData={{ isExternal: true }}
                    >
                        <meshBasicMaterial
                            transparent
                            opacity={0}
                            side={THREE.DoubleSide}
                            depthWrite={false}
                        />
                    </mesh>
                )}

                {showSimulationCell && !isMergeFollower && (
                    <lineSegments geometry={geometry}>
                        <lineBasicMaterial
                            color={isMergeHighlighted
                                ? MERGE_HIGHLIGHT_WIREFRAME_COLOR
                                : (isLightTheme ? '#121212' : '#ffffff')}
                            opacity={isMergeHighlighted
                                ? MERGE_HIGHLIGHT_WIREFRAME_OPACITY
                                : (isLightTheme ? 0.16 : 0.1)}
                            transparent
                        />
                    </lineSegments>
                )}

                {children}
            </group>
        </DragControls>
    );
});

export default SimulationCellBox;
