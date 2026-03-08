import { row, vec3Rows } from '../../../../molecules/CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useMemo } from 'react';
import { MdCameraAlt } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Select from '@/shared/presentation/components/Select';
import { CameraType } from '@/modules/fractal/stores/contracts/editor/visual-types';
import { updateVec3Value } from '../../utilities';

import type { RenderGroup } from '../../types';

const useCameraGroup = (): RenderGroup => {
    const {
        type, position, up, perspective: persp, orthographic: ortho,
        setType, setPosition, setUp, setPerspective, setOrthographic, reset
    } = useEditorStore(useShallow((s) => s.camera));

    return useMemo(() => {
        const sections = {
            projection: {
                key: 'projection', title: 'Projection', enabled: true,
                rows: [],
                extras: (
                    <Container className="canvas-render-grid">
                        <Select
                            value={type}
                            onChange={(value: string) => {
                                if (value === CameraType.Perspective || value === CameraType.Orthographic) {
                                    setType(value);
                                }
                            }}
                            placeholder="Projection"
                            options={[
                                { title: 'Perspective', value: CameraType.Perspective },
                                { title: 'Orthographic', value: CameraType.Orthographic }
                            ]}
                        />
                        <Button variant="ghost" intent="canvas" shape="rounded" size="sm" className="font-size-05" onClick={reset} style={{ justifySelf: 'start' }}>
                            Reset Camera
                        </Button>
                    </Container>
                )
            },
            perspective: {
                key: 'perspective', title: 'Perspective', enabled: type === CameraType.Perspective,
                rows: [
                    row({ label: 'FOV', min: 10, max: 120, step: 1, decimals: 0 }, () => persp?.fov, (v: number) => setPerspective({ fov: Math.round(v) })),
                    row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => persp?.near, (v: number) => setPerspective({ near: v })),
                    row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => persp?.far, (v: number) => setPerspective({ far: v })),
                    row({ label: 'Zoom', min: 0.1, max: 5, step: 0.01, decimals: 2 }, () => persp?.zoom, (v: number) => setPerspective({ zoom: v }))
                ]
            },
            orthographic: {
                key: 'orthographic', title: 'Orthographic', enabled: type === CameraType.Orthographic,
                rows: [
                    row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => ortho?.near, (v: number) => setOrthographic({ near: v })),
                    row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => ortho?.far, (v: number) => setOrthographic({ far: v })),
                    row({ label: 'Zoom', min: 0.1, max: 10, step: 0.01, decimals: 2 }, () => ortho?.zoom, (v: number) => setOrthographic({ zoom: v }))
                ]
            },
            transform: {
                key: 'transform', title: 'Transform', enabled: true,
                rows: [
                    ...vec3Rows('Pos', () => position, (i: number, v: number) => {
                        setPosition(updateVec3Value(position, i, v));
                    }, { min: -1000, max: 1000, step: 0.1, decimals: 2 }),
                    ...vec3Rows('Up', () => up, (i: number, v: number) => {
                        setUp(updateVec3Value(up, i, Math.min(1, Math.max(-1, v))));
                    }, { min: -1, max: 1, step: 0.01, decimals: 2 })
                ]
            }
        };

        return {
            id: 'camera', title: 'Camera',
            icon: <MdCameraAlt size={12} />,
            subsections: [
                { label: 'Projection', sections: [sections.projection] },
                { label: 'Perspective', sections: [sections.perspective], visible: type === CameraType.Perspective },
                { label: 'Orthographic', sections: [sections.orthographic], visible: type === CameraType.Orthographic },
                { label: 'Position', sections: [sections.transform] }
            ]
        };
    }, [type, position, up, persp, ortho]);
};

export default useCameraGroup;
