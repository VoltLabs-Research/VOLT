/* *****************************************************************************
 *
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
***************************************************************************** */

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
    lammps_type: number;
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
    
    const displayAtoms = useMemo(() => {
        if (atoms.length <= 50000) return atoms;
        const step = Math.ceil(atoms.length / 30000);
        const reduced = atoms.filter((_, index) => index % step === 0);
        console.log(`Performance optimization: showing ${reduced.length} of ${atoms.length} atoms (step: ${step})`);
        return reduced;
    }, [atoms]);

    useMouseEvents({
        atoms: displayAtoms,
        scale, yOffset, ctrlPressed, shiftPressed, isDragging, isGroupSelected, dragMode, dragStartPos, dragStartMouse, dragStartRotation, groupPosition, groupRotation,
        startDrag, endDrag, deselectGroup, setGroupPosition, setGroupRotation, setIsGroupSelected, onCameraControlsEnable,
    });

    const typeColors = useMemo(() => ({
        // Red
        1: new THREE.Color(0xff4444),
        // Green
        2: new THREE.Color(0x44ff44), 
        // Blue
        3: new THREE.Color(0x4444ff),
        // Yellow
        4: new THREE.Color(0xffff44),
        // Magenta
        5: new THREE.Color(0xff44ff), 
        // Cyan
        6: new THREE.Color(0x44ffff),
    }), []);

    const colorBuffer = useMemo(() => {
        const colors = new Float32Array(displayAtoms.length * 3);
        // Purple for selection
        const selectedColor = new THREE.Color(0x9d4edd);
        // White as default
        const defaultColor = new THREE.Color(0xffffff); 

        displayAtoms.forEach((atom, i) => {
            const color = isGroupSelected
                ? selectedColor
                : typeColors[atom.lammps_type as keyof typeof typeColors] || defaultColor;
            color.toArray(colors, i * 3);
        });
        return colors;
    }, [displayAtoms, isGroupSelected, typeColors]);

    const center = useMemo(() => {
        if (displayAtoms.length === 0) return new THREE.Vector3(0, 0, 0);
        const centerVec = displayAtoms.reduce(
            (acc, atom) => {
                acc.x += atom.x * scale;
                acc.y += (atom.z * scale) + yOffset;
                acc.z += atom.y * scale;
                return acc;
            },
            new THREE.Vector3(0, 0, 0)
        );
        return centerVec.divideScalar(displayAtoms.length);
    }, [displayAtoms, scale, yOffset]);

    useEffect(() => {
        console.log(atoms[0]);
        const mesh = meshRef.current;
        if(!mesh || displayAtoms.length === 0) return;

        displayAtoms.forEach((atom, i) => {
            const position = new THREE.Vector3(
                atom.x * scale,
                atom.z * scale + yOffset,
                atom.y * scale
            );
            position.sub(center);
            tempMatrix.setPosition(position);
            mesh.setMatrixAt(i, tempMatrix);
        });

        mesh.instanceMatrix.needsUpdate = true;

        const colorAttribute = mesh.geometry.getAttribute('color') as THREE.InstancedBufferAttribute;

        if(colorAttribute){
            colorAttribute.array.set(colorBuffer);
            colorAttribute.needsUpdate = true;
        }else{
            mesh.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorBuffer, 3));
        }
    }, [displayAtoms, scale, yOffset, center, tempMatrix, colorBuffer]);

    useFrame(() => {
        if(groupRef.current){
            groupRef.current.position.copy(center).add(groupPosition);
            groupRef.current.rotation.copy(groupRotation);
        }
    });

    if(displayAtoms.length === 0) return null;

    const sphereRadius = Math.max(0.02, 1 * scale);
    const sphereDetail = displayAtoms.length > 100000 ? [4, 3] : [6, 4];

    return (
        <group ref={groupRef}>
            <instancedMesh
                ref={meshRef}
                args={[undefined, undefined, displayAtoms.length]}
                key={displayAtoms.length}
                frustumCulled={true}
            >
                <sphereGeometry args={[sphereRadius, sphereDetail[0], sphereDetail[1]]} />
                <meshPhongMaterial vertexColors={true} />
            </instancedMesh>
        </group>
    );
};

export default AtomParticles;