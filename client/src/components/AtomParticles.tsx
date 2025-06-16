import React, { useEffect, useMemo, useRef, useState } from 'react';
import useInputStates from '../hooks/useInputStates';
import useGroupTransforms from '../hooks/useGroupTransforms';
import useDragState from '../hooks/useDragState';
import useKeyboardControls from '../hooks/useKeyboardControls';
import useMouseEvents from '../hooks/useMouseEvents';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

const AtomParticles: React.FC<{ 
    atoms: any[]; 
    scale: number;
    onCameraControlsEnable?: (enabled: boolean) => void;
}> = ({ atoms, scale, onCameraControlsEnable }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const groupRef = useRef<THREE.Group>(null);
    const [atomPositions, setAtomPositions] = useState<any[]>(atoms);
    const yOffset = 5;
    const tempMatrix = new THREE.Matrix4();

    const { isCtrlPressed, isShiftPressed } = useInputStates();
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
        isCtrlPressed,
        isShiftPressed,
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
        isCtrlPressed,
        isShiftPressed,
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

    const colorArray = useMemo(() => {
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
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        });
        
        return colors;
    }, [atomPositions]);

    useEffect(() => {
        if(!meshRef.current || atomPositions.length === 0) return;

        // Calculate group center for rotation
        const center = atomPositions.reduce((acc, atom) => {
            acc.x += atom.x * scale;
            acc.y += (atom.z * scale) + yOffset;
            acc.z += atom.y * scale;
            return acc;
        }, new THREE.Vector3(0, 0, 0));
        center.divideScalar(atomPositions.length);

        atomPositions.forEach((atom, i) => {
            // Visual scale according to mode
            let scaleMultiplier = 1.0;
            if(isGroupSelected) scaleMultiplier = 1.2;
            if(isCtrlPressed) scaleMultiplier = 1.3;
            if(isShiftPressed) scaleMultiplier = 1.15;
            if(isDragging) scaleMultiplier = 1.4;

            // Base position of the atom
            const position = new THREE.Vector3(
                atom.x * scale,
                (atom.z * scale) + yOffset,
                atom.y * scale
            );

            // Apply temporary group position
            position.add(groupPosition);

            // Apply rotation of the group around the center
            if(!groupRotation.equals(new THREE.Euler(0, 0, 0))){
                position.sub(center);
                position.applyEuler(groupRotation);
                position.add(center);
            }

            tempMatrix.makeScale(scaleMultiplier, scaleMultiplier, scaleMultiplier);
            tempMatrix.setPosition(position.x, position.y, position.z);

            meshRef.current!.setMatrixAt(i, tempMatrix);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;

        // Update colors according to mode
        if(meshRef.current.geometry.attributes.color){
            const colors = new Float32Array(colorArray);
            if(isDragging){
                const colorModifiers = {
                    rotate: { r: 1.5, g: 1.3, gAdd: 0.3, b: 0.7 },
                    vertical: { r: 1.3, rAdd: 0.3, g: 0.8, b: 1.5 },
                    move: { r: 0.8, rAdd: 0.2, g: 1.5, b: 0.8, bAdd: 0.2 }
                };

                const modifier = colorModifiers[dragMode];
                for(let i = 0; i < atomPositions.length; i++){
                    colors[i * 3] = Math.min(1.0, colors[i * 3] * modifier.r + (modifier.rAdd || 0));
                    colors[i * 3 + 1] = Math.min(1.0, colors[i * 3 + 1] * modifier.g + (modifier.gAdd || 0));
                    colors[i * 3 + 2] = Math.min(1.0, colors[i * 3 + 2] * modifier.b + (modifier.bAdd || 0));
                }
            }else if(isShiftPressed || isCtrlPressed || isGroupSelected){
                const multiplier = (isShiftPressed) ?
                    [0.8, 0.8, 1.5] : ( (isCtrlPressed) ? [1.5, 1.2, 0.8] : [1.3, 1.3, 1.3] );
                for(let i = 0; i < atomPositions.length; i++){
                    colors[i * 3] = Math.min(1.0, colors[i * 3] * multiplier[0] + (isCtrlPressed ? 0.3 : 0.3));
                    colors[i * 3 + 1] = Math.min(1.0, colors[i * 3 + 1] * multiplier[1] + (isCtrlPressed ? 0.3 : 0.3));
                    colors[i * 3 + 2] = Math.min(1.0, colors[i * 3 + 2] * multiplier[2]);
                }
            }

            meshRef.current.geometry.attributes.color.array = colors;
            meshRef.current.geometry.attributes.color.needsUpdate = true;
        }
    }, [atomPositions, colorArray, scale, yOffset, groupRotation, groupPosition, isGroupSelected, isCtrlPressed, isShiftPressed, isDragging, dragMode]);

    if(atomPositions.length === 0){
        return null;
    }

    const sphereRadius = Math.max(0.02, 1 * scale);

    return (
        <group ref={groupRef}>
            <instancedMesh 
                ref={meshRef} 
                args={[undefined, undefined, atomPositions.length]}
            >
                <sphereGeometry args={[sphereRadius, 8, 6]}>
                    <instancedBufferAttribute
                        attach='attributes-color'
                        args={[colorArray, 3]}
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