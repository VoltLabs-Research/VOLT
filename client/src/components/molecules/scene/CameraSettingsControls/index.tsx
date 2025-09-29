import React from 'react';
import Select from '@/components/atoms/form/Select';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/FormField';
import CollapsibleSection from '@/components/atoms/CollapsibleSection';
import useCameraSettings from '@/stores/editor/camera-config';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CameraSettingsControls: React.FC = () => {
    const type = useCameraSettings(s => s.type);
    const position = useCameraSettings(s => s.position);
    const up = useCameraSettings(s => s.up);
    const persp = useCameraSettings(s => s.perspective as any);
    const ortho = useCameraSettings(s => s.orthographic);
    const setType = useCameraSettings(s => s.setType);
    const setPosition = useCameraSettings(s => s.setPosition);
    const setUp = useCameraSettings(s => s.setUp);
    const setPerspective = useCameraSettings(s => s.setPerspective);
    const setOrthographic = useCameraSettings(s => s.setOrthographic);
    const reset = useCameraSettings(s => s.reset);

    const projectionSection = {
        key: 'projection',
        title: 'Projection',
        enabled: true,
        onToggle: () => {},
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 8 }}>
                <Select
                    value={type}
                    onChange={(value) => setType(value as 'perspective' | 'orthographic')}
                    placeholder="Projection"
                    options={[
                        { title: 'Perspective', value: 'perspective' },
                        { title: 'Orthographic', value: 'orthographic' },
                    ]}
                />
                <button
                    type="button"
                    className="btn-reset-camera"
                    onClick={() => reset()}
                    style={{ justifySelf: 'start' }}
                >
                    Reset Camera
                </button>
            </div>
        )
    };

    const perspectiveSection = {
        key: 'perspective',
        title: 'Perspective Optics',
        enabled: type === 'perspective',
        onToggle: () => {},
        rows: [
            {
                label: 'FOV (°)',
                min: 10,
                max: 120,
                step: 1,
                get: () => Number(persp?.fov ?? 50),
                set: (v: number) => setPerspective({ fov: Math.round(v) }),
                format: (v: number) => `${Math.round(v)}°`
            },
            {
                label: 'Near',
                min: 0.001,
                max: Math.max(10, Number(persp?.far ?? 200)),
                step: 0.001,
                get: () => Number(persp?.near ?? 0.01),
                set: (v: number) => setPerspective({ near: v }),
                format: (v: number) => v.toFixed(3)
            },
            {
                label: 'Far',
                min: Math.max(0.01, Number(persp?.near ?? 0.01) + 0.001),
                max: 100000,
                step: 0.1,
                get: () => Number(persp?.far ?? 200),
                set: (v: number) => setPerspective({ far: v }),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Zoom',
                min: 0.1,
                max: 5,
                step: 0.01,
                get: () => Number(persp?.zoom ?? 1),
                set: (v: number) => setPerspective({ zoom: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Focus',
                min: 0,
                max: 100,
                step: 0.1,
                get: () => Number(persp?.focus ?? 5),
                set: (v: number) => setPerspective({ focus: v }),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Film Gauge',
                min: 0,
                max: 70,
                step: 0.1,
                get: () => Number(persp?.filmGauge ?? 35),
                set: (v: number) => setPerspective({ filmGauge: v }),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Film Offset',
                min: -2,
                max: 2,
                step: 0.01,
                get: () => Number(persp?.filmOffset ?? 0),
                set: (v: number) => setPerspective({ filmOffset: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Aspect',
                min: 0.1,
                max: 4,
                step: 0.01,
                get: () => Number(persp?.aspect ?? 1),
                set: (v: number) => setPerspective({ aspect: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Auto Focus Speed',
                min: 0,
                max: 2,
                step: 0.01,
                get: () => Number(persp?.autoFocusSpeed ?? 0.1),
                set: (v: number) => setPerspective({ autoFocusSpeed: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Bokeh Scale',
                min: 0,
                max: 5,
                step: 0.05,
                get: () => Number(persp?.bokehScale ?? 1),
                set: (v: number) => setPerspective({ bokehScale: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Max Blur',
                min: 0,
                max: 0.1,
                step: 0.001,
                get: () => Number(persp?.maxBlur ?? 0.01),
                set: (v: number) => setPerspective({ maxBlur: v }),
                format: (v: number) => v.toFixed(3)
            }
        ],
        extras: (
            <FormField
                fieldKey="enableAutoFocus"
                label="Enable Auto Focus"
                fieldType="checkbox"
                fieldValue={Boolean(persp?.enableAutoFocus ?? false)}
                onFieldChange={(_, enabled) => setPerspective({ enableAutoFocus: Boolean(enabled) })}
            />
        )
    };

    const orthographicSection = {
        key: 'orthographic',
        title: 'Orthographic Optics',
        enabled: type === 'orthographic',
        onToggle: () => {},
        rows: [
            {
                label: 'Near',
                min: 0.001,
                max: Math.max(10, Number(ortho?.far ?? 1000)),
                step: 0.001,
                get: () => Number(ortho?.near ?? 0.1),
                set: (v: number) => setOrthographic({ near: v }),
                format: (v: number) => v.toFixed(3)
            },
            {
                label: 'Far',
                min: Math.max(0.01, Number(ortho?.near ?? 0.1) + 0.001),
                max: 100000,
                step: 0.1,
                get: () => Number(ortho?.far ?? 1000),
                set: (v: number) => setOrthographic({ far: v }),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Zoom',
                min: 0.1,
                max: 10,
                step: 0.01,
                get: () => Number(ortho?.zoom ?? 1),
                set: (v: number) => setOrthographic({ zoom: v }),
                format: (v: number) => v.toFixed(2)
            }
        ]
    };

    const transformSection = {
        key: 'transform',
        title: 'Transform (Z-up)',
        enabled: true,
        onToggle: () => {},
        rows: [
            {
                label: 'Pos X',
                min: -100000,
                max: 100000,
                step: 0.1,
                get: () => Number(position?.[0] ?? 8),
                set: (v: number) => setPosition([v, position?.[1] ?? 8, position?.[2] ?? 6]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Pos Y',
                min: -100000,
                max: 100000,
                step: 0.1,
                get: () => Number(position?.[1] ?? 8),
                set: (v: number) => setPosition([position?.[0] ?? 8, v, position?.[2] ?? 6]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Pos Z',
                min: -100000,
                max: 100000,
                step: 0.1,
                get: () => Number(position?.[2] ?? 6),
                set: (v: number) => setPosition([position?.[0] ?? 8, position?.[1] ?? 8, v]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Up X',
                min: -1,
                max: 1,
                step: 0.01,
                get: () => Number(up?.[0] ?? 0),
                set: (v: number) => setUp([clamp(v, -1, 1), up?.[1] ?? 0, up?.[2] ?? 1]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Up Y',
                min: -1,
                max: 1,
                step: 0.01,
                get: () => Number(up?.[1] ?? 0),
                set: (v: number) => setUp([up?.[0] ?? 0, clamp(v, -1, 1), up?.[2] ?? 1]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Up Z',
                min: -1,
                max: 1,
                step: 0.01,
                get: () => Number(up?.[2] ?? 1),
                set: (v: number) => setUp([up?.[0] ?? 0, up?.[1] ?? 0, clamp(v, -1, 1)]),
                format: (v: number) => v.toFixed(2)
            }
        ]
    };

    const sections = [
        projectionSection,
        ...(type === 'perspective' ? [perspectiveSection] : []),
        ...(type === 'orthographic' ? [orthographicSection] : []),
        transformSection
    ];

    return (
        <CollapsibleSection title="Camera Settings">
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Projection Settings</div>
                    <FormSchema sections={[projectionSection]} />
                </div>
                {type === 'perspective' && (
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Perspective Camera</div>
                        <FormSchema sections={[perspectiveSection]} />
                    </div>
                )}
                {type === 'orthographic' && (
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Orthographic Camera</div>
                        <FormSchema sections={[orthographicSection]} />
                    </div>
                )}
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Transform & Position</div>
                    <FormSchema sections={[transformSection]} />
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default CameraSettingsControls;
