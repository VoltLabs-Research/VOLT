import React, { useEffect } from 'react';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera as ThreePerspective } from 'three';
import type { CameraSettingsState } from '@/modules/fractal/presentation/types/stores/editor/visual-types';

type Props = { orbitRef?: React.RefObject<any>; camera: CameraSettingsState };

const CameraRig: React.FC<Props> = ({ orbitRef, camera }) => {
    const type = camera.type;
    const position = camera.position;
    const up = camera.up;
    const pFov = camera.perspective.fov;
    const pNear = camera.perspective.near;
    const pFar = camera.perspective.far;
    const pZoom = camera.perspective.zoom;
    const pFocus = camera.perspective.focus;
    const pFilmGauge = camera.perspective.filmGauge;
    const pFilmOffset = camera.perspective.filmOffset;
    const oNear = camera.orthographic.near;
    const oFar = camera.orthographic.far;
    const oZoom = camera.orthographic.zoom;

    const { scene } = useThree();

    useEffect(() => {
        scene.up.set(up[0], up[1], up[2]);
    }, [scene, up]);

    useEffect(() => {
        orbitRef?.current?.update?.();
    }, [
        orbitRef,
        type,
        position[0], position[1], position[2],
        up[0], up[1], up[2],
        pFov, pNear, pFar, pZoom, pFocus, pFilmGauge, pFilmOffset,
        oNear, oFar, oZoom
    ]);

    if (type === 'orthographic') {
        return (
            <OrthographicCamera
                key='ortho'
                makeDefault
                position={position}
                up={up}
                near={oNear}
                far={oFar}
                zoom={oZoom}
                onUpdate={(c) => {
                    c.updateProjectionMatrix();
                }}
            />
        );
    }

    return (
        <PerspectiveCamera
            key='persp'
            makeDefault
            position={position}
            up={up}
            fov={pFov}
            near={pNear}
            far={pFar}
            zoom={pZoom}
            onUpdate={(c) => {
                const cam = c as ThreePerspective;
                cam.focus = pFocus;
                cam.filmGauge = pFilmGauge;
                cam.filmOffset = pFilmOffset;
                cam.updateProjectionMatrix();
            }}
        />
    );
};

export default CameraRig;
