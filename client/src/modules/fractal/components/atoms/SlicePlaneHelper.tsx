import React, { useMemo, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { SliceAxis, SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/types/configuration';

const AUTO_HIDE_DELAY = 3000;

const DEFAULT_BOUNDS: ModelWorldBounds = {
    min: { x: -4, y: -4, z: -4 },
    max: { x: 4, y: 4, z: 4 }
};

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
    bounds: ModelWorldBounds;
}

const SinglePlane: React.FC<SinglePlaneProps> = ({ axis, position, angle, bounds }) => {
    const { planePosition, rotation, planeSize } = useMemo(() => {
        const maxVal = bounds.max[axis];
        const minVal = bounds.min[axis];
        const worldPos = maxVal - position * (maxVal - minVal);

        const positionVec = AXIS_NORMALS[axis].clone().multiplyScalar(worldPos);
        const baseRotation = AXIS_ROTATIONS[axis].clone();
        const angleRad = angle * (Math.PI / 180);

        if (axis === 'x') {
            baseRotation.z += angleRad;
        } else if (axis === 'y') {
            baseRotation.x += angleRad;
        } else {
            baseRotation.x += angleRad;
        }

        const dims = {
            x: bounds.max.x - bounds.min.x,
            y: bounds.max.y - bounds.min.y,
            z: bounds.max.z - bounds.min.z
        };

        let size: number;
        if (axis === 'x') {
            size = Math.max(dims.y, dims.z);
        } else if (axis === 'y') {
            size = Math.max(dims.x, dims.z);
        } else {
            size = Math.max(dims.x, dims.y);
        }
        size *= 1.2;

        return {
            planePosition: positionVec,
            rotation: baseRotation,
            planeSize: size
        };
    }, [axis, position, angle, bounds]);

    const edgeGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        const half = planeSize / 2;
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
    }, [planeSize]);

    const edgeLine = useMemo(() => {
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15
        });

        return new THREE.Line(edgeGeometry, material);
    }, [edgeGeometry]);

    return (
        <group position={planePosition} rotation={rotation}>
            <primitive object={edgeLine} />
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

    const modelWorldBounds = useEditorStore(state => state.modelWorldBounds);
    const bounds = modelWorldBounds || DEFAULT_BOUNDS;

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
                    bounds={bounds}
                />
            ))}
        </>
    );
};

export default SlicePlaneHelper;
