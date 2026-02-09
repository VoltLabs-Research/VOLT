import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdCameraAlt, MdViewInAr, MdTransform } from 'react-icons/md';
import { IoCameraOutline } from 'react-icons/io5';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Select from '@/shared/presentation/components/Select';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { row, vec3Rows } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';

type Vec3 = [number, number, number];

const useCameraGroup = (): RenderGroup => {
    const {
        type, position, up, perspective: persp, orthographic: ortho,
        setType, setPosition, setUp, setPerspective, setOrthographic, reset
    } = useEditorStore(useShallow((s) => s.camera));

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

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
                key: 'perspective', title: 'Perspective Optics', enabled: type === 'perspective',
                rows: [
                    row({ label: 'FOV(°)', min: 10, max: 120, step: 1, decimals: 0 }, () => persp?.fov, (v: number) => setPerspective({ fov: Math.round(v) })),
                    row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => persp?.near, (v: number) => setPerspective({ near: v })),
                    row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => persp?.far, (v: number) => setPerspective({ far: v })),
                    row({ label: 'Zoom', min: 0.1, max: 5, step: 0.01 }, () => persp?.zoom, (v: number) => setPerspective({ zoom: v })),
                    row({ label: 'Focus', min: 0, max: 100, step: 0.1, decimals: 1 }, () => persp?.focus, (v: number) => setPerspective({ focus: v })),
                    row({ label: 'Film Gauge', min: 0, max: 70, step: 0.1, decimals: 1 }, () => persp?.filmGauge, (v: number) => setPerspective({ filmGauge: v })),
                    row({ label: 'Film Offset', min: -2, max: 2, step: 0.01 }, () => persp?.filmOffset, (v: number) => setPerspective({ filmOffset: v })),
                    row({ label: 'Aspect', min: 0.1, max: 4, step: 0.01 }, () => persp?.aspect, (v: number) => setPerspective({ aspect: v })),
                    row({ label: 'Auto Focus Speed', min: 0, max: 2, step: 0.01 }, () => persp?.autoFocusSpeed, (v: number) => setPerspective({ autoFocusSpeed: v })),
                    row({ label: 'Bokeh Scale', min: 0, max: 5, step: 0.05 }, () => persp?.bokehScale, (v: number) => setPerspective({ bokehScale: v })),
                    row({ label: 'Max Blur', min: 0, max: 0.1, step: 0.001, decimals: 3 }, () => persp?.maxBlur, (v: number) => setPerspective({ maxBlur: v }))
                ],
                extras: (
                    <FormField
                        fieldKey="enableAutoFocus"
                        label="Enable Auto Focus"
                        fieldType="checkbox"
                        fieldValue={Boolean(persp?.enableAutoFocus)}
                        onFieldChange={(_, v) => setPerspective({ enableAutoFocus: Boolean(v) })}
                    />
                )
            },
            orthographic: {
                key: 'orthographic', title: 'Orthographic Optics', enabled: type === 'orthographic',
                rows: [
                    row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => ortho?.near, (v: number) => setOrthographic({ near: v })),
                    row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => ortho?.far, (v: number) => setOrthographic({ far: v })),
                    row({ label: 'Zoom', min: 0.1, max: 10, step: 0.01 }, () => ortho?.zoom, (v: number) => setOrthographic({ zoom: v }))
                ]
            },
            transform: {
                key: 'transform', title: 'Transform(Z-up)', enabled: true,
                rows: [
                    ...vec3Rows('Pos', () => position, (i: number, v: number) => {
                        const next = [...position] as Vec3;
                        next[i] = v;
                        setPosition(next);
                    }, { min: -100000, max: 100000, step: 0.1, decimals: 2 }),
                    ...vec3Rows('Up', () => up, (i: number, v: number) => {
                        const next = [...up] as Vec3;
                        next[i] = clamp(v, -1, 1);
                        setUp(next);
                    }, { min: -1, max: 1, step: 0.01, decimals: 2 })
                ]
            }
        };

        return {
            id: 'camera', title: 'Camera',
            icon: <MdCameraAlt size={12} />,
            subsections: [
                { label: 'Projection Settings', icon: <MdCameraAlt size={14} />, sections: [sections.projection] },
                { label: 'Perspective Camera', icon: <IoCameraOutline size={14} />, sections: [sections.perspective], visible: type === 'perspective' },
                { label: 'Orthographic Camera', icon: <MdViewInAr size={14} />, sections: [sections.orthographic], visible: type === 'orthographic' },
                { label: 'Transform & Position', icon: <MdTransform size={14} />, sections: [sections.transform] }
            ]
        };
    }, [
        type,
        position,
        up,
        persp,
        ortho,
        setType,
        setPosition,
        setUp,
        setPerspective,
        setOrthographic,
        reset
    ]);
};

export default useCameraGroup;
