import React, { useMemo, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import type { SliceAxis, SlicePlaneConfig } from '@/modules/fractal/presentation/types/configuration';

const PLANE_SIZE = 10;
const AUTO_HIDE_DELAY = 3000;

const AXIS_ROTATIONS: Record<SliceAxis, THREE.Euler> = {
    x: new THREE.Euler(0, Math.PI / 2, 0),
    y: new THREE.Euler(Math.PI / 2, 0, 0),
    z: new THREE.Euler(0, 0, 0)
};

const AXIS_NORMALS: Record<SliceAxis, THREE.Vector3> = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1)
};

interface SinglePlaneProps {
    axis: SliceAxis;
    position: number;
    angle: number;
}

const SinglePlane: React.FC<SinglePlaneProps> = ({ axis, position, angle }) => {
    const { planePosition, rotation } = useMemo(() => {
        const positionVec = AXIS_NORMALS[axis].clone().multiplyScalar(position);
        const baseRotation = AXIS_ROTATIONS[axis].clone();
        const angleRad = angle * (Math.PI / 180);

        if (axis === 'x') {
            baseRotation.z += angleRad;
        } else if (axis === 'y') {
            baseRotation.x += angleRad;
        } else {
            baseRotation.x += angleRad;
        }

        return {
            planePosition: positionVec,
            rotation: baseRotation
        };
    }, [axis, position, angle]);

    const edgeGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        const half = PLANE_SIZE / 2;
        const radius = 0.3;

        shape.moveTo(-half + radius, -half);
        shape.lineTo(half - radius, -half);
        shape.quadraticCurveTo(half, -half, half, -half + radius);
        shape.lineTo(half, half - radius);
        shape.quadraticCurveTo(half, half, half - radius, half);
        shape.lineTo(-half + radius, half);
        shape.quadraticCurveTo(-half, half, -half, half - radius);
        shape.lineTo(-half, -half + radius);
        shape.quadraticCurveTo(-half, -half, -half + radius, -half);

        const points = shape.getPoints(64);
        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);

    return (
        <group position={planePosition} rotation={rotation}>
            <line geometry={edgeGeometry}>
                <lineBasicMaterial
                    color={0xffffff}
                    transparent
                    opacity={0.15}
                    linewidth={1}
                />
            </line>
        </group>
    );
};

interface SlicePlaneHelperProps {
    config: SlicePlaneConfig;
}

const SlicePlaneHelper: React.FC<SlicePlaneHelperProps> = ({ config }) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevConfigRef = useRef(config);

    useEffect(() => {
        const prev = prevConfigRef.current;
        const curr = config;

        const axesChanged = prev.activeAxes.length !== curr.activeAxes.length ||
            !prev.activeAxes.every((axis) => curr.activeAxes.includes(axis));

        const positionsChanged = curr.activeAxes.some(
            (axis) => prev.positions[axis] !== curr.positions[axis]
        );

        const anglesChanged = curr.activeAxes.some(
            (axis) => prev.angles[axis] !== curr.angles[axis]
        );

        if (axesChanged || positionsChanged || anglesChanged) {
            setIsVisible(true);

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                setIsVisible(false);
            }, AUTO_HIDE_DELAY);
        }

        prevConfigRef.current = curr;

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [config]);

    if (!isVisible || config.activeAxes.length === 0) {
        return null;
    }

    return (
        <>
            {config.activeAxes.map((axis) => (
                <SinglePlane
                    key={axis}
                    axis={axis}
                    position={config.positions[axis]}
                    angle={config.angles[axis]}
                />
            ))}
        </>
    );
};

export default SlicePlaneHelper;
