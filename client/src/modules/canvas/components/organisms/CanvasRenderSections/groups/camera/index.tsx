import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdCameraAlt } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import Select from '@/shared/presentation/components/Select';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { row, vec3Rows } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';
import type { Vec3 } from '../types/Vec3';

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
                            onChange={(v: string) => setType(v as 'perspective' | 'orthographic')}
                            placeholder="Projection"
                            options={[
                                { title: 'Perspective', value: 'perspective' },
                                { title: 'Orthographic', value: 'orthographic' }
                            ]}
                        />
                        <Button variant="ghost" intent="canvas" shape="rounded" size="sm" className="font-size-05" onClick={reset} style={{ justifySelf: 'start' }}>
                            Reset Camera
                        </Button>
                    </Container>
                )
            },
            perspective: {
                key: 'perspective', title: 'Perspective', enabled: type === 'perspective',
                rows: [
                    row({ label: 'FOV', min: 10, max: 120, step: 1, decimals: 0 }, () => persp?.fov, (v: number) => setPerspective({ fov: Math.round(v) })),
                    row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => persp?.near, (v: number) => setPerspective({ near: v })),
                    row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => persp?.far, (v: number) => setPerspective({ far: v })),
                    row({ label: 'Zoom', min: 0.1, max: 5, step: 0.01, decimals: 2 }, () => persp?.zoom, (v: number) => setPerspective({ zoom: v }))
                ]
            },
            orthographic: {
                key: 'orthographic', title: 'Orthographic', enabled: type === 'orthographic',
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
                        const next = [...position] as Vec3;
                        next[i] = v;
                        setPosition(next);
                    }, { min: -1000, max: 1000, step: 0.1, decimals: 2 }),
                    ...vec3Rows('Up', () => up, (i: number, v: number) => {
                        const next = [...up] as Vec3;
                        next[i] = Math.min(1, Math.max(-1, v));
                        setUp(next);
                    }, { min: -1, max: 1, step: 0.01, decimals: 2 })
                ]
            }
        };

        return {
            id: 'camera', title: 'Camera',
            icon: <MdCameraAlt size={12} />,
            subsections: [
                { label: 'Projection', sections: [sections.projection] },
                { label: 'Perspective', sections: [sections.perspective], visible: type === 'perspective' },
                { label: 'Orthographic', sections: [sections.orthographic], visible: type === 'orthographic' },
                { label: 'Position', sections: [sections.transform] }
            ]
        };
    }, [type, position, up, persp, ortho]);
};

export default useCameraGroup;
