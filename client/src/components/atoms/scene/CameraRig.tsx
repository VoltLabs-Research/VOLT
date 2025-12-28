import React, { useEffect } from 'react';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera as ThreePerspective } from 'three';
import { useEditorStore } from '@/stores/slices/editor';

type Props = { orbitRef?: React.RefObject<any> };

const CameraRig: React.FC<Props> = ({ orbitRef }) => {
    const type = useEditorStore(s => s.camera.type);
    const position = useEditorStore(s => s.camera.position);
    const up = useEditorStore(s => s.camera.up);

    const pFov = useEditorStore(s => s.camera.perspective.fov);
    const pNear = useEditorStore(s => s.camera.perspective.near);
    const pFar = useEditorStore(s => s.camera.perspective.far);
    const pZoom = useEditorStore(s => s.camera.perspective.zoom);
    const pFocus = useEditorStore(s => s.camera.perspective.focus);
    const pFilmGauge = useEditorStore(s => s.camera.perspective.filmGauge);
    const pFilmOffset = useEditorStore(s => s.camera.perspective.filmOffset);

    const oNear = useEditorStore(s => s.camera.orthographic.near);
    const oFar = useEditorStore(s => s.camera.orthographic.far);
    const oZoom = useEditorStore(s => s.camera.orthographic.zoom);

    const { scene } = useThree();

    useEffect(() => {
        scene.up.set(up[0], up[1], up[2]);
    }, [scene, up]);

    useEffect(() => {
        // This only forces OrbitControls to recalculate matrices when the camera changes;
        // does not touch React/Zustand state, so it does not create loops.
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
                cam.filmGauge = pFilmGauge;
                cam.filmOffset = pFilmOffset;
                cam.updateProjectionMatrix();
            }}
        />
    );
};

export default CameraRig;
