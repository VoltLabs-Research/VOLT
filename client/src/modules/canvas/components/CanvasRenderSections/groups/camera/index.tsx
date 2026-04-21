import { row, vec3Rows } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import {
    CAMERA_SUBSECTION_TITLES,
    CAMERA_TYPE_OPTIONS,
    CameraType,
    isCameraType
} from '@/shared/domain/rendering/camera';

import { useMemo } from 'react';
import { MdCameraAlt } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/shared/presentation/components/Button';
import Select from '@/shared/presentation/components/Select';
import { updateVec3Value } from '../../utilities';

import type { RenderGroup } from '../../types';

const useCameraGroup = (): RenderGroup => {
    const {
        type,
        position,
        up,
        perspective,
        orthographic,
        setType,
        setPosition,
        setUp,
        setPerspective,
        setOrthographic,
        reset
    } = useEditorStore(useShallow((state) => state.camera));

    return useMemo(() => {
        const projectionSection = {
            key: 'projection',
            title: CAMERA_SUBSECTION_TITLES.projection,
            enabled: true,
            rows: [],
            extras: (
                <div className='volt-container canvas-render-grid'>
                    <Select
                        value={type}
                        onChange={(value: string) => {
                            if (isCameraType(value)) {
                                setType(value);
                            }
                        }}
                        placeholder='Projection'
                        options={CAMERA_TYPE_OPTIONS}
                    />
                    <Button variant='ghost' intent='canvas' shape='rounded' size='sm' className='font-size-05' onClick={reset} style={{ justifySelf: 'start' }}>
                        Reset Camera
                    </Button>
                </div>
            )
        };

        const perspectiveSection = {
            key: 'perspective',
            title: CAMERA_SUBSECTION_TITLES.perspective,
            enabled: type === CameraType.Perspective,
            rows: [
                row({ label: 'FOV', min: 10, max: 120, step: 1, decimals: 0 }, () => perspective.fov, (value: number) => setPerspective({ fov: Math.round(value) })),
                row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => perspective.near, (value: number) => setPerspective({ near: value })),
                row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => perspective.far, (value: number) => setPerspective({ far: value })),
                row({ label: 'Zoom', min: 0.1, max: 5, step: 0.01, decimals: 2 }, () => perspective.zoom, (value: number) => setPerspective({ zoom: value }))
            ]
        };

        const orthographicSection = {
            key: 'orthographic',
            title: CAMERA_SUBSECTION_TITLES.orthographic,
            enabled: type === CameraType.Orthographic,
            rows: [
                row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => orthographic.near, (value: number) => setOrthographic({ near: value })),
                row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => orthographic.far, (value: number) => setOrthographic({ far: value })),
                row({ label: 'Zoom', min: 0.1, max: 10, step: 0.01, decimals: 2 }, () => orthographic.zoom, (value: number) => setOrthographic({ zoom: value }))
            ]
        };

        const transformSection = {
            key: 'transform',
            title: CAMERA_SUBSECTION_TITLES.transform,
            enabled: true,
            rows: [
                ...vec3Rows('Pos', () => position, (index: number, value: number) => {
                    setPosition(updateVec3Value(position, index, value));
                }, { min: -1000, max: 1000, step: 0.1, decimals: 2 }),
                ...vec3Rows('Up', () => up, (index: number, value: number) => {
                    setUp(updateVec3Value(up, index, Math.min(1, Math.max(-1, value))));
                }, { min: -1, max: 1, step: 0.01, decimals: 2 })
            ]
        };

        return {
            id: 'camera',
            title: 'Camera',
            icon: <MdCameraAlt size={12} />,
            subsections: [
                { label: CAMERA_SUBSECTION_TITLES.projection, sections: [projectionSection] },
                { label: CAMERA_SUBSECTION_TITLES.perspective, sections: [perspectiveSection], visible: type === CameraType.Perspective },
                { label: CAMERA_SUBSECTION_TITLES.orthographic, sections: [orthographicSection], visible: type === CameraType.Orthographic },
                { label: CAMERA_SUBSECTION_TITLES.position, sections: [transformSection] }
            ]
        };
    }, [
        orthographic,
        perspective,
        position,
        reset,
        setOrthographic,
        setPerspective,
        setPosition,
        setType,
        setUp,
        type,
        up
    ]);
};

export default useCameraGroup;
