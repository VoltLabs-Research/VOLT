import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
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
    
    const [atomPositions, setAtomPositions] = useState<AtomPosition[]>(atoms);
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
        setAtomPositions,
        setGroupRotation,
        setIsGroupSelected,
        resetTransforms,
        resetRotation,
        atomPositions
    });

    useMouseEvents({
        atomPositions,
        scale,
        yOffset,
        ctrlPressed,
        shiftPressed,
        isDragging,
        dragMode,
        dragStartPos,
        dragStartMouse,
        dragStartRotation,
        groupPosition,
        groupRotation,
        startDrag,
        endDrag,
        setGroupPosition,
        setGroupRotation,
        setIsGroupSelected,
        setAtomPositions,
        onCameraControlsEnable
    });

    useEffect(() => {
        setAtomPositions([...atoms]);
    }, [atoms]);

    const baseColors = useMemo(() => {
        const colors = new Float32Array(atomPositions.length * 3);
        const typeColors = {
            1: new THREE.Color(0xff4444),
            2: new THREE.Color(0x44ff44),
            3: new THREE.Color(0x4444ff),
            4: new THREE.Color(0xffff44),
            5: new THREE.Color(0xff44ff),
            6: new THREE.Color(0x44ffff),
        };
        
        atomPositions.forEach((atom, i) => {
            const color = typeColors[atom.type as keyof typeof typeColors] || new THREE.Color(0xffffff);
            color.toArray(colors, i * 3);
        });
        
        return colors;
    }, [atomPositions]);

    const [persistentColors, setPersistentColors] = useState(baseColors);

    useEffect(() => {
        setPersistentColors(baseColors);
    }, [baseColors]);
    
    useEffect(() => {
        if (isGroupSelected) {
            const newColors = new Float32Array(atomPositions.length * 3);
            const selectedColor = new THREE.Color(0x9d4edd);
            for (let i = 0; i < atomPositions.length; i++) {
                selectedColor.toArray(newColors, i * 3);
            }
            setPersistentColors(newColors);
        }
    }, [isGroupSelected, atomPositions.length]);


    useEffect(() => {
        if(!meshRef.current || atomPositions.length === 0) return;

        const center = atomPositions.reduce((acc, atom) => {
            acc.x += atom.x * scale;
            acc.y += (atom.z * scale) + yOffset;
            acc.z += atom.y * scale;
            return acc;
        }, new THREE.Vector3(0, 0, 0));
        center.divideScalar(atomPositions.length);

        atomPositions.forEach((atom, i) => {
            const position = new THREE.Vector3(
                atom.x * scale,
                (atom.z * scale) + yOffset,
                atom.y * scale
            );
            
            position.add(groupPosition);
            
            if(!groupRotation.equals(new THREE.Euler(0, 0, 0))){
                position.sub(center);
                position.applyEuler(groupRotation);
                position.add(center);
            }
            
            tempMatrix.setPosition(position);
            meshRef.current!.setMatrixAt(i, tempMatrix);
        });
        
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [atomPositions, scale, yOffset, groupRotation, groupPosition, tempMatrix]);

    useEffect(() => {
        if (!meshRef.current?.geometry.attributes.color) return;

        const colors = persistentColors.slice();
        let scaleMultiplier = 1.0;

        if (isGroupSelected) {
            scaleMultiplier = 1;
        }

        if (isDragging) {
            scaleMultiplier = 1;
            const colorModifiers = {
                rotate: { r: 1.5, g: 1.3, gAdd: 0.3, b: 0.7 },
                vertical: { r: 1.3, rAdd: 0.3, g: 0.8, b: 1.5 },
                move: { r: 0.8, rAdd: 0.2, g: 1.5, b: 0.8, bAdd: 0.2 }
            };
            const modifier = colorModifiers[dragMode];
            for (let i = 0; i < atomPositions.length; i++) {
                colors[i * 3] = Math.min(1.0, colors[i * 3] * modifier.r + (modifier.rAdd || 0));
                colors[i * 3 + 1] = Math.min(1.0, colors[i * 3 + 1] * modifier.g + (modifier.gAdd || 0));
                colors[i * 3 + 2] = Math.min(1.0, colors[i * 3 + 2] * modifier.b + (modifier.bAdd || 0));
            }
        } else if (ctrlPressed) {
            scaleMultiplier = 1;
        } else if (shiftPressed) {
            scaleMultiplier = 1;
        }

        (meshRef.current.geometry.attributes.color as THREE.InstancedBufferAttribute).array = colors;
        meshRef.current.geometry.attributes.color.needsUpdate = true;

        if (meshRef.current.scale.x !== scaleMultiplier) {
            meshRef.current.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
        }

    }, [isDragging, ctrlPressed, shiftPressed, isGroupSelected, dragMode, atomPositions.length, persistentColors]);
    
    if (atomPositions.length === 0) {
        return null;
    }

    const sphereRadius = Math.max(0.02, 1 * scale);

    return (
        <group ref={groupRef}>
            <instancedMesh 
                ref={meshRef} 
                args={[undefined, undefined, atomPositions.length]}
                key={atomPositions.length}
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