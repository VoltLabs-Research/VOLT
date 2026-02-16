import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { BoxBounds } from '@/modules/fractal/presentation/types';
import { getBoxDimensions } from '@/modules/fractal/presentation/utilities/boxUtils';

interface SimulationCellBoxProps {
    boxBounds?: BoxBounds;
    children?: React.ReactNode;
    transforms?: {
        scale: number;
        position: { x: number; y: number; z: number };
        groundOffset?: number;
    };
}

const SimulationCellBox = React.forwardRef<THREE.Mesh, SimulationCellBoxProps>(({
    boxBounds,
    children,
    transforms
}, ref) => {
    const groupRef = useRef<THREE.Group>(null!);

    // Apply position/scale imperatively instead of via declarative JSX props.
    // R3F reconciles declarative props on every re-render, which overrides
    // any imperative transforms applied by FractalEngine (drag, rotate, scale).
    // By applying them in useEffect, they only reset when transforms actually change
    // (e.g. on timestep change), not on unrelated re-renders.
    useEffect(() => {
        const group = groupRef.current;
        if (!group) return;
        if (transforms) {
            group.position.set(
                transforms.position.x,
                transforms.position.y,
                transforms.position.z + (transforms.groundOffset || 0)
            );
            const s = transforms.scale || 1;
            group.scale.set(s, s, s);
        } else {
            group.position.set(0, 0, 0);
            group.scale.set(1, 1, 1);
        }
    }, [transforms]);

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
        return <group ref={groupRef}>{children}</group>;
    }

    return (
        <group ref={groupRef}>
            {boxGeometry && (
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

            <lineSegments geometry={geometry}>
                <lineBasicMaterial color='white' opacity={0.1} transparent />
            </lineSegments>

            {children}
        </group>
    );
});

export default SimulationCellBox;
