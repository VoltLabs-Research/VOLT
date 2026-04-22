import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { OrthographicCamera, PerspectiveCamera } from 'three';

import {
    getAngleDirection,
    getAngleUpVector,
    getCaptureBounds,
    resolveOrthographicFraming,
    resolvePerspectiveDistance,
    resolveViewBasis
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

        const controls = orbitRef?.current;
        const direction = getAngleDirection('front');
        if (!direction) return;

        const captureBounds = getCaptureBounds(scene, modelWorldBounds);
        if (!captureBounds) return;

        const target = captureBounds.center.clone();
        const basis = resolveViewBasis(direction, getAngleUpVector('front', scene.up));

        let distance = Math.max(controls?.minDistance ?? 0.1, 1);

        if (camera instanceof PerspectiveCamera) {
            distance = resolvePerspectiveDistance(captureBounds, basis, camera, controls?.minDistance ?? 0.1);
        } else if (camera instanceof OrthographicCamera) {
            const orthographicFraming = resolveOrthographicFraming(captureBounds, basis, camera, controls?.minDistance ?? 0.1);
            distance = orthographicFraming.distance;
            camera.zoom = orthographicFraming.zoom;
        } else {
            distance = Math.max(controls?.minDistance ?? 0.1, 8);
        }

        camera.position.copy(target.clone().addScaledVector(direction, distance));
        camera.up.copy(basis.up);

        if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
            camera.updateProjectionMatrix();
        }

        if (controls) {
            controls.target.copy(target);
            controls.update();
        } else {
            camera.lookAt(target);
        }

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
