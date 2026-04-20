import { DragControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { BoxBounds } from '@/modules/fractal/types';
import { getBoxDimensions } from '@/modules/fractal/utilities/box-utils';
import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, useEffect, forwardRef, useState, useCallback } from 'react';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { localModelDragBus, remoteModelDragBus } from '@/modules/canvas/collaboration/live-drag-bus';
import type { ReactNode, RefObject } from 'react';

interface SimulationCellTransforms {
    scale: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
    groundOffset?: number;
};

interface SimulationCellBoxProps {
    boxBounds?: BoxBounds;
    children?: ReactNode;
    transforms?: SimulationCellTransforms;
    orbitControlsRef?: RefObject<{ enabled: boolean } | null>;
    onSelect?: (target: THREE.Group | null) => void;
    onHoverChange?: (hovered: boolean) => void;
};

// Reusable scratch vectors to avoid allocations in the hot drag path.
const _decomposePos = new THREE.Vector3();
const _decomposeQuat = new THREE.Quaternion();
const _decomposeScale = new THREE.Vector3();
const _clampedPos = new THREE.Vector3();
const _identityQuat = new THREE.Quaternion();
const _unitScale = new THREE.Vector3(1, 1, 1);
const _cameraForward = new THREE.Vector3();

type DragAxisLock = 'x' | 'y' | 'z';
const FLOOR_AXIS_LOCK: DragAxisLock = 'z';

const SimulationCellBox = forwardRef<THREE.Mesh, SimulationCellBoxProps>(({
    boxBounds,
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
    // Keep drag matrix in a ref — mutated imperatively during drag to avoid
    // React re-renders of the entire subtree (model with millions of points).
    const dragMatrixRef = useRef(new THREE.Matrix4());
    // Interpolation refs: remote updates move the target; a per-frame lerp
    // chases it from the current position for visual smoothing.
    const currentDragPosRef = useRef(new THREE.Vector3());
    const targetDragPosRef = useRef(new THREE.Vector3());
    // Position captured at drag start — used in vertical mode to freeze X/Y
    // so only Z changes regardless of which plane DragControls picked.
    const dragStartPosRef = useRef(new THREE.Vector3());
    const showSimulationCell = useEditorStore((state) => state.showSimulationCell);
    const modelDragOffset = useEditorStore((state) => state.modelDragOffset);
    const setModelDragOffset = useEditorStore((state) => state.setModelDragOffset);
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());
    const [axisLock, setAxisLock] = useState<DragAxisLock>(FLOOR_AXIS_LOCK);
    const axisLockRef = useRef<DragAxisLock>(FLOOR_AXIS_LOCK);
    axisLockRef.current = axisLock;

    // Pick the vertical drag plane (XZ or YZ) whose normal points most at the
    // camera, so the pointer has the best leverage over Z.
    const pickVerticalAxisLock = useCallback((): DragAxisLock => {
        camera.getWorldDirection(_cameraForward);
        return Math.abs(_cameraForward.x) > Math.abs(_cameraForward.y) ? 'y' : 'x';
    }, [camera]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Alt' && axisLockRef.current === FLOOR_AXIS_LOCK) {
                setAxisLock(pickVerticalAxisLock());
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Alt') {
                setAxisLock(FLOOR_AXIS_LOCK);
            }
        };
        const handleBlur = () => setAxisLock(FLOOR_AXIS_LOCK);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [pickVerticalAxisLock]);

    useEffect(() => {
        return subscribeToAppTheme(setTheme);
    }, []);

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

        const { x, y, z } = useEditorStore.getState().modelDragOffset;
        currentDragPosRef.current.set(x, y, z);
        targetDragPosRef.current.copy(currentDragPosRef.current);
        dragMatrixRef.current.compose(currentDragPosRef.current, _identityQuat, _unitScale);

        if (dragRef.current) {
            dragRef.current.matrix.copy(dragMatrixRef.current);
            dragRef.current.matrixWorldNeedsUpdate = true;
        }
        invalidate();
    }, [boxBounds, transforms, invalidate]);

    useEffect(() => {
        if (isDraggingRef.current) return;
        targetDragPosRef.current.set(modelDragOffset.x, modelDragOffset.y, modelDragOffset.z);
        invalidate();
    }, [modelDragOffset, invalidate]);

    useEffect(() => {
        return remoteModelDragBus.on((offset) => {
            if (isDraggingRef.current) return;
            targetDragPosRef.current.set(offset.x, offset.y, offset.z);
            invalidate();
        });
    }, [invalidate]);

    useFrame((_, delta) => {
        if (isDraggingRef.current) return;

        const current = currentDragPosRef.current;
        const target = targetDragPosRef.current;
        if (current.distanceToSquared(target) < 1e-6) return;

        // Frame-rate independent smoothing: higher factor = snappier, lower = softer.
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
        if (!boxBounds) return null;

        const { xlo, xhi, ylo, yhi, zlo, zhi } = boxBounds;

        const points = [
            new THREE.Vector3(xlo, ylo, zlo), new THREE.Vector3(xhi, ylo, zlo),
            new THREE.Vector3(xhi, ylo, zlo), new THREE.Vector3(xhi, yhi, zlo),
            new THREE.Vector3(xhi, yhi, zlo), new THREE.Vector3(xlo, yhi, zlo),
            new THREE.Vector3(xlo, yhi, zlo), new THREE.Vector3(xlo, ylo, zlo),

            new THREE.Vector3(xlo, ylo, zhi), new THREE.Vector3(xhi, ylo, zhi),
            new THREE.Vector3(xhi, ylo, zhi), new THREE.Vector3(xhi, yhi, zhi),
            new THREE.Vector3(xhi, yhi, zhi), new THREE.Vector3(xlo, yhi, zhi),
            new THREE.Vector3(xlo, yhi, zhi), new THREE.Vector3(xlo, ylo, zhi),

            new THREE.Vector3(xlo, ylo, zlo), new THREE.Vector3(xlo, ylo, zhi),
            new THREE.Vector3(xhi, ylo, zlo), new THREE.Vector3(xhi, ylo, zhi),
            new THREE.Vector3(xhi, yhi, zlo), new THREE.Vector3(xhi, yhi, zhi),
            new THREE.Vector3(xlo, yhi, zlo), new THREE.Vector3(xlo, yhi, zhi)
        ];

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return geo;
    }, [boxBounds]);

    const boxGeometry = useMemo(() => {
        if (!boxBounds) return null;
        const { width, height, depth, center } = getBoxDimensions(boxBounds);

        const geo = new THREE.BoxGeometry(width, height, depth);
        geo.translate(center.x, center.y, center.z);
        return geo;
    }, [boxBounds]);

    if (!boxBounds || !geometry) {
        return <group ref={contentRef}>{children}</group>;
    }

    return (
        <DragControls
            ref={dragRef}
            autoTransform={false}
            axisLock={axisLock}
            matrix={dragMatrixRef.current}
            dragLimits={[
                undefined,
                undefined,
                [0, Number.POSITIVE_INFINITY]
            ]}
            onHover={onHoverChange}
            onDragStart={() => {
                isDraggingRef.current = true;
                dragStartPosRef.current.copy(currentDragPosRef.current);
                onSelect?.(contentRef.current);
                if (orbitControlsRef?.current) {
                    orbitControlsRef.current.enabled = false;
                }
            }}
            onDrag={(localMatrix: THREE.Matrix4) => {
                // Decompose into scratch vectors — zero allocations.
                localMatrix.decompose(_decomposePos, _decomposeQuat, _decomposeScale);
                // In vertical mode DragControls drags on XZ or YZ; freeze the
                // in-plane horizontal axis so the motion feels purely up/down.
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

                // Mutate the ref matrix in-place and apply directly to the
                // DragControls group — no React state update, no re-render.
                dragMatrixRef.current.compose(_clampedPos, _decomposeQuat, _decomposeScale);

                if (dragRef.current) {
                    dragRef.current.matrix.copy(dragMatrixRef.current);
                    dragRef.current.matrixWorldNeedsUpdate = true;
                }
                currentDragPosRef.current.copy(_clampedPos);
                targetDragPosRef.current.copy(_clampedPos);
                localModelDragBus.emit({
                    x: _clampedPos.x,
                    y: _clampedPos.y,
                    z: _clampedPos.z
                });
                invalidate();
            }}
            onDragEnd={() => {
                isDraggingRef.current = false;
                dragMatrixRef.current.decompose(_decomposePos, _decomposeQuat, _decomposeScale);
                currentDragPosRef.current.copy(_decomposePos);
                targetDragPosRef.current.copy(_decomposePos);
                setModelDragOffset({
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
