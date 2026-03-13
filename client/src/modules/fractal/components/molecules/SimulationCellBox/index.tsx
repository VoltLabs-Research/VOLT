import { DragControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { BoxBounds } from '@/modules/fractal/types';
import { getBoxDimensions } from '@/modules/fractal/utilities/box-utils';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, useEffect, useState, forwardRef } from 'react';
import { useEditorStore } from '@/modules/canvas/stores/editor';
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

const SimulationCellBox = forwardRef<THREE.Mesh, SimulationCellBoxProps>(({
    boxBounds,
    children,
    transforms,
    orbitControlsRef,
    onSelect,
    onHoverChange
}, ref) => {
    const invalidate = useThree((state) => state.invalidate);
    const dragRef = useRef<THREE.Group>(null!);
    const contentRef = useRef<THREE.Group>(null!);
    const isDraggingRef = useRef(false);
    const [dragMatrix, setDragMatrix] = useState(() => new THREE.Matrix4());
    const showSimulationCell = useEditorStore((state) => state.showSimulationCell);

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
        setDragMatrix(new THREE.Matrix4());
    }, [boxBounds, transforms]);

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
            matrix={dragMatrix}
            dragLimits={[
                undefined,
                undefined,
                [0, Number.POSITIVE_INFINITY]
            ]}
            onHover={onHoverChange}
            onDragStart={() => {
                isDraggingRef.current = true;
                onSelect?.(contentRef.current);
                if (orbitControlsRef?.current) {
                    orbitControlsRef.current.enabled = false;
                }
            }}
            onDrag={(localMatrix: THREE.Matrix4) => {
                const nextPosition = new THREE.Vector3();
                const nextQuaternion = new THREE.Quaternion();
                const nextScale = new THREE.Vector3();

                localMatrix.decompose(nextPosition, nextQuaternion, nextScale);

                const nextMatrix = new THREE.Matrix4();
                nextMatrix.compose(
                    new THREE.Vector3(nextPosition.x, nextPosition.y, Math.max(0, nextPosition.z)),
                    nextQuaternion,
                    nextScale
                );

                setDragMatrix(nextMatrix);
                invalidate();
            }}
            onDragEnd={() => {
                isDraggingRef.current = false;
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
                        <lineBasicMaterial color='white' opacity={0.1} transparent />
                    </lineSegments>
                )}

                {children}
            </group>
        </DragControls>
    );
});

export default SimulationCellBox;
