import React, { useEffect, useMemo, useRef } from 'react';
import type { AtomPosition } from '../types';
import * as THREE from 'three';

const AtomParticles: React.FC<{ atoms: AtomPosition[]; scale: number }> = ({ atoms, scale }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    const yOffset = 5; 
    
    const colorArray = useMemo(() => {
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
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        });
        
        return colors;
    }, [atoms]);

    useEffect(() => {
        if (!meshRef.current || atoms.length === 0) return;

        const tempMatrix = new THREE.Matrix4();
        atoms.forEach((atom, i) => {
            tempMatrix.setPosition(
                atom.x * scale, 
                (atom.z * scale) + yOffset,
                atom.y * scale
            );
            meshRef.current!.setMatrixAt(i, tempMatrix);
        });
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        
        if (meshRef.current.geometry.attributes.color) {
            meshRef.current.geometry.attributes.color.array = colorArray;
            meshRef.current.geometry.attributes.color.needsUpdate = true;
        }
    }, [atoms, colorArray, scale, yOffset]);

    if (atoms.length === 0) return null;

    const sphereRadius = Math.max(0.02, 1 * scale);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, atoms.length]}>
            <sphereGeometry args={[sphereRadius, 12, 8]}>
                <instancedBufferAttribute
                    attach='attributes-color'
                    args={[colorArray, 3]}
                />
            </sphereGeometry>
            <meshPhongMaterial vertexColors />
        </instancedMesh>
    );
};

export default AtomParticles;