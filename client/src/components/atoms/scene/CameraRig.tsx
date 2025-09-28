import React, { useEffect } from 'react';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera as ThreePerspective } from 'three';
import useCameraSettings from '@/stores/editor/camera-config';

type Props = { orbitRef?: React.RefObject<any> };

const CameraRig: React.FC<Props> = ({ orbitRef }) => {
    const type = useCameraSettings(s => s.type);
    const position = useCameraSettings(s => s.position);
    const up = useCameraSettings(s => s.up);

    const pFov = useCameraSettings(s => s.perspective.fov);
    const pNear = useCameraSettings(s => s.perspective.near);
    const pFar = useCameraSettings(s => s.perspective.far);
    const pZoom = useCameraSettings(s => s.perspective.zoom);
    const pFocus = useCameraSettings(s => s.perspective.focus);
    const pFilmGauge = useCameraSettings(s => s.perspective.filmGauge);
    const pFilmOffset = useCameraSettings(s => s.perspective.filmOffset);

    const oNear = useCameraSettings(s => s.orthographic.near);
    const oFar = useCameraSettings(s => s.orthographic.far);
    const oZoom = useCameraSettings(s => s.orthographic.zoom);

    const { scene } = useThree();

    useEffect(() => {
        scene.up.set(up[0], up[1], up[2]);
    }, [scene, up]);

    useEffect(() => {
        // Esto solo fuerza a OrbitControls a recalcular matrices cuando cambia la cámara;
        // no toca estado de React/Zustand, por lo que no crea loops.
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
                key="ortho"
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
            key="persp"
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
                // @ts-expect-error propiedades válidas en three, no tipadas en d.ts
                cam.filmGauge = pFilmGauge;
                // @ts-expect-error idem
                cam.filmOffset = pFilmOffset;
                cam.updateProjectionMatrix();
            }}
        />
    );
};

export default CameraRig;
