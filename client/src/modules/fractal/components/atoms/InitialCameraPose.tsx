import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import {
    applyCameraAnglePreset,
    getCaptureBounds
} from '@/modules/fractal/utilities/camera-framing';

import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { MutableRefObject } from 'react';

interface InitialCameraPoseProps {
    orbitRef?: MutableRefObject<OrbitControlsHandle | null>;
    modelWorldBounds?: ModelWorldBounds | null;
}

const InitialCameraPose = ({ orbitRef, modelWorldBounds }: InitialCameraPoseProps) => {
    const { scene, camera, invalidate } = useThree();
    const hasAppliedRef = useRef(false);

    useEffect(() => {
        if (hasAppliedRef.current) return;
        if (!modelWorldBounds) return;

        const captureBounds = getCaptureBounds(scene, modelWorldBounds);
        if (!captureBounds) return;

        const controls = orbitRef?.current;
        const target = captureBounds.center.clone();
        applyCameraAnglePreset({
            anglePreset: 'front',
            camera,
            sceneUp: scene.up,
            target,
            captureBounds,
            controls
        });

        hasAppliedRef.current = true;
        invalidate();

        if (controls) {
            window.dispatchEvent(new CustomEvent('Volt:camera-initial-update', {
                detail: {
                    position: [camera.position.x, camera.position.y, camera.position.z],
                    target: [controls.target.x, controls.target.y, controls.target.z]
                }
            }));
        }
    }, [camera, invalidate, modelWorldBounds, orbitRef, scene]);

    return null;
};

export default InitialCameraPose;
