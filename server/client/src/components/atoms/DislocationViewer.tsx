import React, { useRef, useEffect } from 'react';
import type { DislocationSegment } from '../hooks/useTimestepDataManager';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface DislocationViewerProps{
    segments: DislocationSegment[];
    scale?: number;
    showBurgersVectors?: boolean;
    centerOffset?: [number, number, number];
}

const BurgersVectorArrow: React.FC<{
    position: [number, number, number];
    direction: [number, number, number];
    scale: number;
    color: THREE.Color
}> = ({ position, direction, scale, color }) => {
    const arrowRef = useRef<THREE.Group>(null);

    useEffect(() => {
        if(!arrowRef.current) return;

        const [dx, dy, dz] = direction;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if(length === 0) return;

        const arrowLength = length * scale * 0.5;
        const normalizedDir = [dx / length, dz / length, dy / length];
        const dir = new THREE.Vector3(...normalizedDir);

        arrowRef.current.lookAt(
            position[0] + (dir.x * arrowLength),
            position[1] + (dir.y * arrowLength),
            position[2] + (dir.z * arrowLength)
        );
    }, [direction, position, scale]);

    const arrowLength = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2) * scale * 0.3;
    
    if(arrowLength === 0) return null;

      return (
        <group ref={arrowRef} position={position}>
            <mesh position={[0, 0, arrowLength / 2]}>
                <cylinderGeometry args={[0.02 * scale, 0.02 * scale, arrowLength, 8]} />
                <meshBasicMaterial color={color} transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, 0, arrowLength]}>
                <coneGeometry args={[0.05 * scale, 0.1 * scale, 8]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>
    );
};

const DislocationViewer: React.FC<DislocationViewerProps> = ({
    segments,
    scale = 1,
    showBurgersVectors = true,
    centerOffset = [0, 0, 0]
}) => {
    if(!segments || segments.length === 0) return null;

    const getLineColor = (segment: DislocationSegment): THREE.Color => {
        const type = segment.type || 'unknown';
        switch (type) {
            case 'screw':
                return new THREE.Color(0xff0000);
            case 'edge':
                return new THREE.Color(0x0000ff);
            case 'mixed':
                return new THREE.Color(0x00ff00); 
            case 'unknown':
                return new THREE.Color(0x808080); 
            default:
                return new THREE.Color(0xffffff);
        }
    };

    const getLineWidth = (segment: DislocationSegment): number => {
        const baseWidth = 4.0;
        const factor = Math.log((segment.length ?? 0) + 1) / 5;
        
        return baseWidth + factor;
    };

    return (
        <group position={centerOffset}>
            {segments.map((segment, index) => {
                if(!segment.points || segment.points.length < 2){
                    return null;
                }

                const points: [number, number, number][] = segment.points.map((point) => [
                    point[0] * scale,
                    point[2] * scale,
                    point[1] * scale
                ]);

                const color = getLineColor(segment);
                const lineWidth = getLineWidth(segment);
                const burgers_vector = segment.burgers_vector ?? [0, 0, 0];

                return (
                    <group key={`segment-${segment.id}-${index}`}>
                        <Line
                            points={points}
                            color={color}
                            lineWidth={lineWidth}
                            dashed={false} />
                        
                        {showBurgersVectors && (
                            <BurgersVectorArrow
                                position={points[Math.floor(points.length / 2)]}
                                direction={burgers_vector as [number, number, number]}
                                scale={scale}
                                color={color} />
                        )}
                    </group>
                );
            })}
        </group>
    )
};

export default DislocationViewer;