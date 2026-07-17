import { DragControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { BoxBounds } from '@/modules/fractal/api/types/model';
import { getBoxDimensions } from '@/modules/fractal/utilities/box-utils';
import {
    buildAabbWireframeGeometry,
    buildCellWireframeGeometry,
    hasValidCellVectors
} from '@/modules/fractal/utilities/cell-wireframe';
import type { CellPbc } from '@/modules/fractal/utilities/cell-wireframe';
import { Theme } from '@/shared/ui/hooks/use-theme';
import { useMedia } from '@voltstack/bravais';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/ui/utilities/app-theme';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, useEffect, forwardRef, useState, useCallback } from 'react';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { localModelDragBus, remoteModelDragBus } from '@/modules/canvas/collaboration/live-drag-bus';
import type { ReactNode, RefObject } from 'react';

export interface SimulationCellGeometryView {
    cellVectors?: number[][];
    cellOrigin?: number[];
    pbc?: CellPbc;
    showPbcImages?: boolean;
}

interface SimulationCellTransforms {
    scale: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
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
const _identityQuat = new THREE.Quaternion();
const _unitScale = new THREE.Vector3(1, 1, 1);
const _cameraForward = new THREE.Vector3();

type DragAxisLock = 'x' | 'y' | 'z';
const FLOOR_AXIS_LOCK: DragAxisLock = 'z';

const ZERO_OFFSET = { x: 0, y: 0, z: 0 } as const;
const DOUBLE_TAP_MAX_DELAY_MS = 320;
const DOUBLE_TAP_MAX_DISTANCE_PX = 24;
const TOUCH_DRAG_ARM_TIMEOUT_MS = 800;
const isPrimaryDragModifierPressed = (event: KeyboardEvent) => event.ctrlKey || event.metaKey;

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
    const showSimulationCell = useEditorStore((state) => state.showSimulationCell);
    const modelDragOffset = useEditorStore((state) => state.modelDragOffsets[sceneKey] ?? ZERO_OFFSET);
    const setModelDragOffsetForScene = useEditorStore((state) => state.setModelDragOffsetForScene);
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());
    const [axisLock, setAxisLock] = useState<DragAxisLock>(FLOOR_AXIS_LOCK);
    const [isDesktopDragModifierActive, setIsDesktopDragModifierActive] = useState(false);
    const [isDesktopDragSessionActive, setIsDesktopDragSessionActive] = useState(false);
    const axisLockRef = useRef<DragAxisLock>(FLOOR_AXIS_LOCK);
    const isMobileViewport = useMedia('(max-width: 768px)');
    const lastPointerTypeRef = useRef<string | null>(null);
    const lastTouchTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
    const touchDragArmedRef = useRef(false);
    const suppressCurrentTouchDragRef = useRef(false);
    const touchDragArmTimerRef = useRef<number | null>(null);
    axisLockRef.current = axisLock;

    const pickVerticalAxisLock = useCallback((): DragAxisLock => {
        camera.getWorldDirection(_cameraForward);
        return Math.abs(_cameraForward.x) > Math.abs(_cameraForward.y) ? 'y' : 'x';
    }, [camera]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Alt' && axisLockRef.current === FLOOR_AXIS_LOCK) {
                setAxisLock(pickVerticalAxisLock());
            }

            if (!isMobileViewport) {
                setIsDesktopDragModifierActive(isPrimaryDragModifierPressed(event));
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Alt') {
                setAxisLock(FLOOR_AXIS_LOCK);
            }

            if (!isMobileViewport) {
                setIsDesktopDragModifierActive(isPrimaryDragModifierPressed(event));
            }
        };
        const handleBlur = () => {
            setAxisLock(FLOOR_AXIS_LOCK);
            setIsDesktopDragModifierActive(false);
        };

        if (isMobileViewport) {
            setIsDesktopDragModifierActive(false);
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isMobileViewport, pickVerticalAxisLock]);

    useEffect(() => {
        return subscribeToAppTheme(setTheme);
    }, []);

    const clearTouchDragArmTimer = useCallback(() => {
        if (touchDragArmTimerRef.current !== null) {
            window.clearTimeout(touchDragArmTimerRef.current);
            touchDragArmTimerRef.current = null;
        }
    }, []);

    const disarmTouchDrag = useCallback(() => {
        touchDragArmedRef.current = false;
        clearTouchDragArmTimer();
    }, [clearTouchDragArmTimer]);

    const armTouchDrag = useCallback(() => {
        touchDragArmedRef.current = true;
        clearTouchDragArmTimer();
        touchDragArmTimerRef.current = window.setTimeout(() => {
            touchDragArmedRef.current = false;
            touchDragArmTimerRef.current = null;
        }, TOUCH_DRAG_ARM_TIMEOUT_MS);
    }, [clearTouchDragArmTimer]);

    useEffect(() => {
        return () => clearTouchDragArmTimer();
    }, [clearTouchDragArmTimer]);

    const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
        lastPointerTypeRef.current = event.pointerType;
        if (!isMobileViewport || event.pointerType !== 'touch') {
            return;
        }

        const now = Date.now();
        const previousTap = lastTouchTapRef.current;
        const isDoubleTap = Boolean(
            previousTap &&
            now - previousTap.time <= DOUBLE_TAP_MAX_DELAY_MS &&
            Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <= DOUBLE_TAP_MAX_DISTANCE_PX
        );

        lastTouchTapRef.current = {
            time: now,
            x: event.clientX,
            y: event.clientY
        };

        if (isDoubleTap) {
            armTouchDrag();
            return;
        }

        disarmTouchDrag();
    }, [armTouchDrag, disarmTouchDrag, isMobileViewport]);

    const simulationCellMaterial = useMemo(() => {
        if (theme === Theme.Light) {
            return {
                color: '#121212',
                opacity: 0.16
            };
        }

        return {
            color: '#ffffff',
            opacity: 0.1
        };
    }, [theme]);

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
    }, [transforms]);

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
        invalidate();
    }, [boxBounds, transforms, invalidate, sceneKey]);

    useEffect(() => {
        if (isDraggingRef.current) return;
        targetDragPosRef.current.set(modelDragOffset.x, modelDragOffset.y, modelDragOffset.z);
        invalidate();
    }, [modelDragOffset, invalidate]);

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

    const geometry = useMemo(() => {
        if (cellGeometry && hasValidCellVectors(cellGeometry.cellVectors)) {
            return buildCellWireframeGeometry(
                cellGeometry.cellVectors!,
                cellGeometry.cellOrigin,
                { pbc: cellGeometry.pbc, showPbcImages: cellGeometry.showPbcImages }
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

    useEffect(() => () => {
        geometry?.dispose();
    }, [geometry]);

    useEffect(() => () => {
        boxGeometry?.dispose();
    }, [boxGeometry]);

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
                    enabled: isDesktopDragModifierActive || isDesktopDragSessionActive
                }}
            dragLimits={[
                undefined,
                undefined,
                [0, Number.POSITIVE_INFINITY]
            ]}
            onHover={onHoverChange}
            onDragStart={() => {
                const isMobileTouchGesture = isMobileViewport && lastPointerTypeRef.current === 'touch';
                if (isMobileTouchGesture && !touchDragArmedRef.current) {
                    suppressCurrentTouchDragRef.current = true;
                    if (orbitControlsRef?.current) {
                        orbitControlsRef.current.enabled = true;
                    }
                    return;
                }

                suppressCurrentTouchDragRef.current = false;
                if (isMobileTouchGesture) {
                    disarmTouchDrag();
                }
                isDraggingRef.current = true;
                if (!isMobileTouchGesture) {
                    setIsDesktopDragSessionActive(true);
                }
                dragStartPosRef.current.copy(currentDragPosRef.current);
                onSelect?.(contentRef.current);
                if (orbitControlsRef?.current) {
                    orbitControlsRef.current.enabled = false;
                }
            }}
            onDrag={(localMatrix: THREE.Matrix4) => {
                if (suppressCurrentTouchDragRef.current) {
                    return;
                }

                localMatrix.decompose(_decomposePos, _decomposeQuat, _decomposeScale);
                const isVertical = axisLockRef.current !== FLOOR_AXIS_LOCK;
                if (isVertical) {
                    _clampedPos.set(
                        dragStartPosRef.current.x,
                        dragStartPosRef.current.y,
                        Math.max(0, _decomposePos.z)
                    );
                } else {
                    _clampedPos.set(_decomposePos.x, _decomposePos.y, Math.max(0, _decomposePos.z));
                }

                dragMatrixRef.current.compose(_clampedPos, _decomposeQuat, _decomposeScale);

                if (dragRef.current) {
                    dragRef.current.matrix.copy(dragMatrixRef.current);
                    dragRef.current.matrixWorldNeedsUpdate = true;
                }
                currentDragPosRef.current.copy(_clampedPos);
                targetDragPosRef.current.copy(_clampedPos);
                localModelDragBus.emit({
                    sceneKey,
                    offset: {
                        x: _clampedPos.x,
                        y: _clampedPos.y,
                        z: _clampedPos.z
                    }
                });
                invalidate();
            }}
            onDragEnd={() => {
                if (suppressCurrentTouchDragRef.current) {
                    suppressCurrentTouchDragRef.current = false;
                    if (orbitControlsRef?.current) {
                        orbitControlsRef.current.enabled = true;
                    }
                    return;
                }

                isDraggingRef.current = false;
                setIsDesktopDragSessionActive(false);
                dragMatrixRef.current.decompose(_decomposePos, _decomposeQuat, _decomposeScale);
                currentDragPosRef.current.copy(_decomposePos);
                targetDragPosRef.current.copy(_decomposePos);
                setModelDragOffsetForScene(sceneKey, {
                    x: _decomposePos.x,
                    y: _decomposePos.y,
                    z: _decomposePos.z
                });
                invalidate();
                if (orbitControlsRef?.current) {
                    orbitControlsRef.current.enabled = true;
                }
            }}
        >
            <group
                ref={contentRef}
                onPointerDown={handlePointerDown}
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

                {showSimulationCell && (
                    <lineSegments geometry={geometry}>
                        <lineBasicMaterial color={simulationCellMaterial.color} opacity={simulationCellMaterial.opacity} transparent />
                    </lineSegments>
                )}

                {children}
            </group>
        </DragControls>
    );
});

export default SimulationCellBox;
