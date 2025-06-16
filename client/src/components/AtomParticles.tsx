import React, { useEffect, useMemo, useRef, useState } from 'react';
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
        resetRotation 
    } = useGroupTransforms();
    
    const { 
        isDragging, 
        dragMode, 
        dragStartPos, 
        dragStartMouse, 
        dragStartRotation, 
        startDrag, 
        endDrag 
    } = useDragState();

    useKeyboardControls({
        ctrlPressed,
        shiftPressed,
        isGroupSelected,
        setGroupPosition,
        setGroupRotation,
        setIsGroupSelected,
        resetTransforms,
        resetRotation
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
        onCameraControlsEnable
    });

    const baseColors = useMemo(() => {
        const colors = new Float32Array(atoms.length * 3);
        const typeColors = {
            1: new THREE.Color(0xff4444),
            2: new THREE.Color(0x44ff44),
            3: new THREE.Color(0x4444ff),
            4: new THREE.Color(0xffff44),
            5: new THREE.Color(0xff44ff),
            6: new THREE.Color(0x44ffff),
        };
        
        atoms.forEach((atom, i) => {
            const color = typeColors[atom.type as keyof typeof typeColors] || new THREE.Color(0xffffff);
            color.toArray(colors, i * 3);
        });
        
        return colors;
    }, [atoms]);

    const [persistentColors, setPersistentColors] = useState(baseColors);

    useEffect(() => {
        if (isGroupSelected) {
            const newColors = new Float32Array(atoms.length * 3);
            const selectedColor = new THREE.Color(0x9d4edd);
            for (let i = 0; i < atoms.length; i++) {
                selectedColor.toArray(newColors, i * 3);
            }
            setPersistentColors(newColors);
        } else {
            setPersistentColors(baseColors);
        }
    }, [isGroupSelected, atoms.length, baseColors]);

    useEffect(() => {
        if(!meshRef.current || atoms.length === 0) return;

        const center = atoms.reduce((acc, atom) => {
            acc.x += atom.x * scale;
            acc.y += (atom.z * scale) + yOffset;
            acc.z += atom.y * scale;
            return acc;
        }, new THREE.Vector3(0, 0, 0));
        center.divideScalar(atoms.length);

        atoms.forEach((atom, i) => {
            const position = new THREE.Vector3(
                atom.x * scale,
                (atom.z * scale) + yOffset,
                atom.y * scale
            );
            
            if(!groupRotation.equals(new THREE.Euler(0, 0, 0))){
                const relativePos = position.clone().sub(center);
                relativePos.applyEuler(groupRotation);
                position.copy(center).add(relativePos);
            }
            
            position.add(groupPosition);
            
            tempMatrix.setPosition(position);
            meshRef.current!.setMatrixAt(i, tempMatrix);
        });
        
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [atoms, scale, yOffset, groupRotation, groupPosition, tempMatrix]);

    useEffect(() => {
        if (!meshRef.current?.geometry.attributes.color) return;
        (meshRef.current.geometry.attributes.color as THREE.InstancedBufferAttribute).array = persistentColors;
        meshRef.current.geometry.attributes.color.needsUpdate = true;
    }, [persistentColors]);
    
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
            >
                <sphereGeometry args={[sphereRadius, 8, 6]}>
                    <instancedBufferAttribute
                        attach='attributes-color'
                        args={[persistentColors, 3]}
                    />
                </sphereGeometry>
                <meshPhongMaterial 
                    vertexColors
                />
            </instancedMesh>
        </group>
    );
};

export default AtomParticles;