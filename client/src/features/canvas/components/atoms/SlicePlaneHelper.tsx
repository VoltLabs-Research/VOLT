/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import React, { useMemo, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '@/features/canvas/stores/editor';
import type { SliceAxis } from '@/types/stores/editor/configuration';

const PLANE_SIZE = 10;
const AUTO_HIDE_DELAY = 3000;

const AXIS_ROTATIONS: Record<SliceAxis, THREE.Euler> = {
    x: new THREE.Euler(0, Math.PI / 2, 0),
    y: new THREE.Euler(Math.PI / 2, 0, 0),
    z: new THREE.Euler(0, 0, 0),
};

const AXIS_NORMALS: Record<SliceAxis, THREE.Vector3> = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
};

interface SinglePlaneProps {
    axis: SliceAxis;
    position: number;
    angle: number;
}

const SinglePlane: React.FC<SinglePlaneProps> = React.memo(({ axis, position, angle }) => {
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
            rotation: baseRotation,
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
});

SinglePlane.displayName = 'SinglePlane';

const SlicePlaneHelper: React.FC = () => {
    const slicePlaneConfig = useEditorStore((s) => s.configuration.slicePlaneConfig);
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevConfigRef = useRef(slicePlaneConfig);

    useEffect(() => {
        const prev = prevConfigRef.current;
        const curr = slicePlaneConfig;

        const axesChanged = prev.activeAxes.length !== curr.activeAxes.length ||
            !prev.activeAxes.every(a => curr.activeAxes.includes(a));
        
        const positionsChanged = curr.activeAxes.some(
            axis => prev.positions[axis] !== curr.positions[axis]
        );
        
        const anglesChanged = curr.activeAxes.some(
            axis => prev.angles[axis] !== curr.angles[axis]
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
    }, [slicePlaneConfig]);

    if (!isVisible || slicePlaneConfig.activeAxes.length === 0) {
        return null;
    }

    return (
        <>
            {slicePlaneConfig.activeAxes.map((axis) => (
                <SinglePlane
                    key={axis}
                    axis={axis}
                    position={slicePlaneConfig.positions[axis]}
                    angle={slicePlaneConfig.angles[axis]}
                />
            ))}
        </>
    );
};

export default React.memo(SlicePlaneHelper);
