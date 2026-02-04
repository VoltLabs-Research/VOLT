import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdCameraAlt, MdViewInAr, MdTransform } from 'react-icons/md';
import { IoCameraOutline } from 'react-icons/io5';
import Select from '@/shared/presentation/components/Select';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { row, vec3Rows } from '@/modules/canvas/presentation/components/molecules/controls/config-helpers';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CameraSettingsControls = () => {
    const {
        type, position, up, perspective: persp, orthographic: ortho,
        setType, setPosition, setUp, setPerspective, setOrthographic, reset
    } = useEditorStore(useShallow((s) => s.camera));

    const sections = {
        projection: {
            key: 'projection',
            title: 'Projection',
            enabled: true,
            rows: [],
            extras: (
                <div style={{ display: 'grid', gap: 8 }}>
                    <Select
                        value={type}
                        onChange={(v) => setType(v as 'perspective' | 'orthographic')}
                        placeholder='Projection'
                        options={[
                            { title: 'Perspective', value: 'perspective' },
                            { title: 'Orthographic', value: 'orthographic' }
                        ]}
                    />
                    <Button variant='ghost' intent='neutral' size='sm' onClick={reset} style={{ justifySelf: 'start' }}>
                        Reset Camera
                    </Button>
                </div>
            )
        },
        perspective: {
            key: 'perspective',
            title: 'Perspective Optics',
            enabled: type === 'perspective',
            rows: [
                row({ label: 'FOV(°)', min: 10, max: 120, step: 1, decimals: 0 }, () => persp?.fov ?? 50, (v) => setPerspective({ fov: Math.round(v) })),
                row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => persp?.near ?? 0.01, (v) => setPerspective({ near: v })),
                row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => persp?.far ?? 200, (v) => setPerspective({ far: v })),
                row({ label: 'Zoom', min: 0.1, max: 5, step: 0.01 }, () => persp?.zoom ?? 1, (v) => setPerspective({ zoom: v })),
                row({ label: 'Focus', min: 0, max: 100, step: 0.1, decimals: 1 }, () => persp?.focus ?? 5, (v) => setPerspective({ focus: v })),
                row({ label: 'Film Gauge', min: 0, max: 70, step: 0.1, decimals: 1 }, () => persp?.filmGauge ?? 35, (v) => setPerspective({ filmGauge: v })),
                row({ label: 'Film Offset', min: -2, max: 2, step: 0.01 }, () => persp?.filmOffset ?? 0, (v) => setPerspective({ filmOffset: v })),
                row({ label: 'Aspect', min: 0.1, max: 4, step: 0.01 }, () => persp?.aspect ?? 1, (v) => setPerspective({ aspect: v })),
                row({ label: 'Auto Focus Speed', min: 0, max: 2, step: 0.01 }, () => persp?.autoFocusSpeed ?? 0.1, (v) => setPerspective({ autoFocusSpeed: v })),
                row({ label: 'Bokeh Scale', min: 0, max: 5, step: 0.05 }, () => persp?.bokehScale ?? 1, (v) => setPerspective({ bokehScale: v })),
                row({ label: 'Max Blur', min: 0, max: 0.1, step: 0.001, decimals: 3 }, () => persp?.maxBlur ?? 0.01, (v) => setPerspective({ maxBlur: v }))
            ],
            extras: (
                <FormField
                    fieldKey='enableAutoFocus'
                    label='Enable Auto Focus'
                    fieldType='checkbox'
                    fieldValue={Boolean(persp?.enableAutoFocus ?? false)}
                    onFieldChange={(_, v) => setPerspective({ enableAutoFocus: Boolean(v) })}
                />
            )
        },
        orthographic: {
            key: 'orthographic',
            title: 'Orthographic Optics',
            enabled: type === 'orthographic',
            rows: [
                row({ label: 'Near', min: 0.001, max: 10, step: 0.001, decimals: 3 }, () => ortho?.near ?? 0.1, (v) => setOrthographic({ near: v })),
                row({ label: 'Far', min: 0.01, max: 100000, step: 0.1, decimals: 1 }, () => ortho?.far ?? 1000, (v) => setOrthographic({ far: v })),
                row({ label: 'Zoom', min: 0.1, max: 10, step: 0.01 }, () => ortho?.zoom ?? 1, (v) => setOrthographic({ zoom: v }))
            ]
        },
        transform: {
            key: 'transform',
            title: 'Transform(Z-up)',
            enabled: true,
            rows: [
                ...vec3Rows('Pos', () => position ?? [8, 8, 6], (i, v) => {
                    const next = [...(position ?? [8, 8, 6])];
                    next[i] = v;
                    setPosition(next as [number, number, number]);
                }, { min: -100000, max: 100000, step: 0.1, decimals: 2 }),
                ...vec3Rows('Up', () => up ?? [0, 0, 1], (i, v) => {
                    const next = [...(up ?? [0, 0, 1])];
                    next[i] = clamp(v, -1, 1);
                    setUp(next as [number, number, number]);
                }, { min: -1, max: 1, step: 0.01, decimals: 2 })
            ]
        }
    };

    return (
        <SettingsPanel
            title='Camera Settings'
            icon={<MdCameraAlt size={16} />}
            subsections={[
                { label: 'Projection Settings', icon: <MdCameraAlt size={14} />, sections: [sections.projection] },
                { label: 'Perspective Camera', icon: <IoCameraOutline size={14} />, sections: [sections.perspective], visible: type === 'perspective' },
                { label: 'Orthographic Camera', icon: <MdViewInAr size={14} />, sections: [sections.orthographic], visible: type === 'orthographic' },
                { label: 'Transform & Position', icon: <MdTransform size={14} />, sections: [sections.transform] }
            ]}
        />
    );
};

export default memo(CameraSettingsControls);
