/**
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
**/

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import type { DislocationVisualizerProps } from '../../types/index';

const DislocationVisualizer: React.FC<DislocationVisualizerProps> = ({
    dislocations,
    selectedDislocationId,
    visible = true,
    scale = 1
}) => {
    const groupRef = useRef<THREE.Group>(null);

    const getDislocationColor = (type: string, isSelected: boolean): string => {
        if(isSelected) return '#ffff00';
        
        switch (type.toLowerCase()){
            case 'edge': return '#3b82f6';
            case 'screw': return '#ef4444';
            case 'mixed': return '#8b5cf6';
            case 'loop': return '#10b981'; 
            default: return '#6b7280';
        }
    };

    const dislocationComponents = useMemo(() => {
        if(!visible || dislocations.length === 0) return [];
        return dislocations.map((dislocation, index) => {
            const isSelected = selectedDislocationId === dislocation.id;
            const color = getDislocationColor(dislocation.type, isSelected);
            const lineWidth = isSelected ? 4 : 2;
            const opacity = isSelected ? 1.0 : 0.8;

            const linePoints = dislocation.line_points.map(point => 
                new THREE.Vector3(point[0] * scale, point[1] * scale, point[2] * scale)
            );

            const coreAtomSpheres = dislocation.core_atoms.map((atomIndex, atomIdx) => (
                <Sphere
                    key={`${dislocation.id}-atom-${atomIndex}-${atomIdx}`}
                    position={[
                        (dislocation.line_points[0]?.[0] || 0) * scale,
                        (dislocation.line_points[0]?.[1] || 0) * scale,
                        (dislocation.line_points[0]?.[2] || 0) * scale
                    ]}
                    args={[0.1 * scale]}
                >
                    <meshBasicMaterial 
                        color={color} 
                        transparent 
                        opacity={opacity * 0.6}
                    />
                </Sphere>
            ));

            return (
                <group key={dislocation.id || index}>
                    {linePoints.length > 1 && (
                        <Line
                            points={linePoints}
                            color={color}
                            lineWidth={lineWidth}
                            transparent
                            opacity={opacity}
                        />
                    )}
                    
                    {coreAtomSpheres}
                    
                    {dislocation.burgers_vector.length >= 3 && linePoints.length > 0 && (
                        <Line
                            points={[
                                linePoints[Math.floor(linePoints.length / 2)],
                                new THREE.Vector3(
                                    linePoints[Math.floor(linePoints.length / 2)].x + dislocation.burgers_vector[0] * scale,
                                    linePoints[Math.floor(linePoints.length / 2)].y + dislocation.burgers_vector[1] * scale,
                                    linePoints[Math.floor(linePoints.length / 2)].z + dislocation.burgers_vector[2] * scale
                                )
                            ]}
                            color={isSelected ? '#ffaa00' : '#ff6600'}
                            lineWidth={lineWidth + 1}
                            transparent
                            opacity={opacity}
                        />
                    )}
                    
                    {dislocation.loops && dislocation.loops.map((loop, loopIndex) => (
                        <group key={`${dislocation.id}-loop-${loopIndex}`}>
                            {loop.atoms.length > 2 && (
                                <Line
                                    points={loop.atoms.map((atomPos, idx) => 
                                        new THREE.Vector3(
                                            (loop.center[0] + Math.cos(idx * 2 * Math.PI / loop.atoms.length)) * scale,
                                            (loop.center[1] + Math.sin(idx * 2 * Math.PI / loop.atoms.length)) * scale,
                                            loop.center[2] * scale
                                        )
                                    )}
                                    color={color}
                                    lineWidth={lineWidth - 1}
                                    transparent
                                    opacity={opacity * 0.7}
                                />
                            )}
                        </group>
                    ))}
                </group>
            );
        });
    }, [dislocations, selectedDislocationId, visible, scale]);

    useFrame((state) => {
        if(groupRef.current && selectedDislocationId){
            const time = state.clock.getElapsedTime();
            groupRef.current.children.forEach((child, index) => {
                const dislocation = dislocations[index];
                if(dislocation?.id === selectedDislocationId){
                    child.scale.setScalar(1 + Math.sin(time * 3) * 0.05);
                }else {
                    child.scale.setScalar(1);
                }
            });
        }
    });

    if(!visible) return null;

    return (
        <group ref={groupRef}>
            {dislocationComponents}
        </group>
    );
};

export default DislocationVisualizer;
