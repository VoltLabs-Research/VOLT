import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useInputStates from '../hooks/useInputStates';
import useGroupTransforms from '../hooks/useGroupTransforms';
import useDragState from '../hooks/useDragState';
import useKeyboardControls from '../hooks/useKeyboardControls';
import useMouseEvents from '../hooks/useMouseEvents';

interface AtomPosition {
    x: number;
    y: number;
    z: number;
    type: number;
}

const AtomParticles: React.FC<{
    atoms: AtomPosition[];
    scale: number;
    onCameraControlsEnable?: (enabled: boolean) => void;
}> = ({ atoms, scale, onCameraControlsEnable }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const groupRef = useRef<THREE.Group>(null);
    const yOffset = 5;
    const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

    const { ctrlPressed, shiftPressed } = useInputStates();
    const {
        groupRotation,
        setGroupRotation,
        groupPosition,
        setGroupPosition,
        isGroupSelected,
        setIsGroupSelected,
        resetTransforms,
        deselectGroup,
        resetRotation,
    } = useGroupTransforms();

    const {
        isDragging,
        dragMode,
        dragStartPos,
        dragStartMouse,
        dragStartRotation,
        startDrag,
        endDrag,
    } = useDragState();

    useKeyboardControls({
        ctrlPressed,
        shiftPressed,
        isGroupSelected,
        setGroupPosition,
        setGroupRotation,
        setIsGroupSelected,
        resetTransforms,
        resetRotation,
    });

    useMouseEvents({
        atoms,
        scale,
        yOffset,
        ctrlPressed,
        shiftPressed,
        isDragging,
        isGroupSelected,
        dragMode,
        dragStartPos,
        dragStartMouse,
        dragStartRotation,
        groupPosition,
        groupRotation,
        startDrag,
        endDrag,
        deselectGroup,
        setGroupPosition,
        setGroupRotation,
        setIsGroupSelected,
        onCameraControlsEnable,
    });

    const typeColors = useMemo(() => ({
        1: new THREE.Color(0xff4444),
        2: new THREE.Color(0x44ff44),
        3: new THREE.Color(0x4444ff),
        4: new THREE.Color(0xffff44),
        5: new THREE.Color(0xff44ff),
        6: new THREE.Color(0x44ffff),
    }), []);

    const colorBuffer = useMemo(() => {
        const colors = new Float32Array(atoms.length * 3);
        const selectedColor = new THREE.Color(0x9d4edd);
        atoms.forEach((atom, i) => {
            const color = isGroupSelected
                ? selectedColor
                : typeColors[atom.type as keyof typeof typeColors] || new THREE.Color(0xffffff);
            color.toArray(colors, i * 3);
        });
        return colors;
    }, [atoms, isGroupSelected, typeColors]);

    const center = useMemo(() => {
        if (atoms.length === 0) return new THREE.Vector3(0, 0, 0);
        const centerVec = atoms.reduce(
            (acc, atom) => {
                acc.x += atom.x * scale;
                acc.y += (atom.z * scale) + yOffset;
                acc.z += atom.y * scale;
                return acc;
            },
            new THREE.Vector3(0, 0, 0)
        );
        return centerVec.divideScalar(atoms.length);
    }, [atoms, scale, yOffset]);

    useEffect(() => {
        if (!meshRef.current || atoms.length === 0) return;

        const matrices = new Float32Array(atoms.length * 16);
        atoms.forEach((atom, i) => {
            const position = new THREE.Vector3(
                atom.x * scale,
                (atom.z * scale) + yOffset,
                atom.y * scale
            );
            position.sub(center);
            tempMatrix.setPosition(position);
            tempMatrix.toArray(matrices, i * 16);
        });

        meshRef.current.instanceMatrix.array.set(matrices);
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.geometry.attributes.color.array.set(colorBuffer);
        meshRef.current.geometry.attributes.color.needsUpdate = true;
    }, [atoms, scale, yOffset, center, colorBuffer, tempMatrix]);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.position.copy(center).add(groupPosition);
            groupRef.current.rotation.copy(groupRotation);
        }
    });

    if (atoms.length === 0) {
        return null;
    }

    const sphereRadius = Math.max(0.02, 1 * scale);

    return (
        <group ref={groupRef}>
            <instancedMesh
                ref={meshRef}
                args={[undefined, undefined, atoms.length]}
                key={atoms.length}
                frustumCulled={true}
            >
                <sphereGeometry args={[sphereRadius, 6, 4]}>
                    <instancedBufferAttribute
                        attach="attributes-color"
                        args={[colorBuffer, 3]}
                    />
                </sphereGeometry>
                <meshPhongMaterial
                    vertexColors
                    transparent={false}
                    depthWrite={true}
                />
            </instancedMesh>
        </group>
    );
};

export default AtomParticles;