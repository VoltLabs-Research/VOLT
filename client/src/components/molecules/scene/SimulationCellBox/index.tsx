import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { BoxBounds } from '@/types/models';

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
    console.log('[SimulationCellBox] Render', {
        hasBoxBounds: !!boxBounds,
        boxBounds,
        transforms
    });
    const geometry = useMemo(() => {
        if (!boxBounds) return null;

        const { xlo, xhi, ylo, yhi, zlo, zhi } = boxBounds;

        // Create the box points
        const points = [

            // Bottom face
            new THREE.Vector3(xlo, ylo, zlo), new THREE.Vector3(xhi, ylo, zlo),
            new THREE.Vector3(xhi, ylo, zlo), new THREE.Vector3(xhi, yhi, zlo),
            new THREE.Vector3(xhi, yhi, zlo), new THREE.Vector3(xlo, yhi, zlo),
            new THREE.Vector3(xlo, yhi, zlo), new THREE.Vector3(xlo, ylo, zlo),

            // Top face
            new THREE.Vector3(xlo, ylo, zhi), new THREE.Vector3(xhi, ylo, zhi),
            new THREE.Vector3(xhi, ylo, zhi), new THREE.Vector3(xhi, yhi, zhi),
            new THREE.Vector3(xhi, yhi, zhi), new THREE.Vector3(xlo, yhi, zhi),
            new THREE.Vector3(xlo, yhi, zhi), new THREE.Vector3(xlo, ylo, zhi),

            // Vertical connections
            new THREE.Vector3(xlo, ylo, zlo), new THREE.Vector3(xlo, ylo, zhi),
            new THREE.Vector3(xhi, ylo, zlo), new THREE.Vector3(xhi, ylo, zhi),
            new THREE.Vector3(xhi, yhi, zlo), new THREE.Vector3(xhi, yhi, zhi),
            new THREE.Vector3(xlo, yhi, zlo), new THREE.Vector3(xlo, yhi, zhi),
        ];

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return geo;
    }, [boxBounds]);

    const boxGeometry = useMemo(() => {
        if (!boxBounds) return null;
        const { xlo, xhi, ylo, yhi, zlo, zhi } = boxBounds;
        const width = xhi - xlo;
        const height = yhi - ylo;
        const depth = zhi - zlo;

        // Calculate center for geometry offset
        const centerX = (xlo + xhi) / 2;
        const centerY = (ylo + yhi) / 2;
        const centerZ = (zlo + zhi) / 2;

        const geo = new THREE.BoxGeometry(width, height, depth);
        geo.translate(centerX, centerY, centerZ);
        return geo;
    }, [boxBounds]);

    if (!boxBounds || !geometry) {
        // Even if no bounds/geometry, we must respect the scene position
        const fallbackPos: [number, number, number] = transforms ? [
            transforms.position.x,
            transforms.position.y,
            transforms.position.z + (transforms.groundOffset || 0)
        ] : [0, 0, 0];

        return <group position={fallbackPos}>{children}</group>;
    }

    // Calcular transformaciones para el group
    const groupPosition: [number, number, number] = transforms ? [
        transforms.position.x,
        transforms.position.y,
        transforms.position.z + (transforms.groundOffset || 0)
    ] : [0, 0, 0];

    const groupScale = transforms?.scale || 1;

    return (
        <group
            position={groupPosition}
            scale={[groupScale, groupScale, groupScale]}
        >
            {/* Invisible mesh for raycasting */}
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

            {/* El wireframe del box */}
            <lineSegments geometry={geometry}>
                <lineBasicMaterial color="white" opacity={0.3} transparent />
            </lineSegments>

            {/* El modelo GLB hereda las transformaciones del group padre */}
            {children}
        </group>
    );
});

export default SimulationCellBox;
