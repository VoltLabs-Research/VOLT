import { CameraType } from '@/shared/rendering/camera';
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import type { CameraSettingsState } from '@/modules/fractal/contracts/editor/visual-types';
import type { OrbitControlsHandle } from '@/modules/fractal/contracts';
import type { FC, RefObject } from 'react';
import type { PerspectiveCamera as ThreePerspective } from 'three';

interface CameraRigProps {
    orbitRef?: RefObject<OrbitControlsHandle | null>;
    camera: CameraSettingsState;
}

const CameraRig: FC<CameraRigProps> = ({ orbitRef, camera }) => {
    const type = camera.type;
    const position = camera.position;
    const up = camera.up;
    const [posX, posY, posZ] = position;
    const [upX, upY, upZ] = up;
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
        posX, posY, posZ,
        upX, upY, upZ,
        pFov, pNear, pFar, pZoom, pFocus, pFilmGauge, pFilmOffset,
        oNear, oFar, oZoom
    ]);

    if (type === CameraType.Orthographic) {
        return (
            <OrthographicCamera
                key='ortho'
                makeDefault
                position={position}
                up={up}
                near={oNear}
                far={oFar}
                zoom={oZoom}
                onUpdate={(cameraState) => {
                    cameraState.updateProjectionMatrix();
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
            onUpdate={(cameraState: ThreePerspective) => {
                cameraState.focus = pFocus;
                cameraState.filmGauge = pFilmGauge;
                cameraState.filmOffset = pFilmOffset;
                cameraState.updateProjectionMatrix();
            }}
        />
    );
};

export default CameraRig;
