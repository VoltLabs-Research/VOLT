import React from 'react';
import FormField from '@/shared/presentation/components/FormField';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { MdSettings, MdStraighten, MdOpacity, MdColorLens, MdTransform } from 'react-icons/md';
import { IoGridOutline } from 'react-icons/io5';

const CanvasGridControls: React.FC = () => {
    const settings = useEditorStore(useShallow((s) => s.grid));
    const {
        setEnabled,
        setInfiniteGrid,
        setCellSize,
        setSectionSize,
        setCellThickness,
        setSectionThickness,
        setFadeDistance,
        setFadeStrength,
        setSectionColor,
        setCellColor,
        setPosition,
        setRotation,
        enabled,
        infiniteGrid,
        cellSize,
        sectionSize,
        cellThickness,
        sectionThickness,
        fadeDistance,
        fadeStrength,
        sectionColor,
        cellColor,
        position,
        rotation
    } = settings;

    const generalSection = {
        key: 'general',
        title: 'General Settings',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <FormField
                        fieldKey='enabled'
                        label='Enabled'
                        fieldType='checkbox'
                        fieldValue={enabled}
                        onFieldChange={(_, v) => setEnabled(Boolean(v))}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Show/hide the canvas grid</div>
                </div>
                <div>
                    <FormField
                        fieldKey='infiniteGrid'
                        label='Infinite Grid'
                        fieldType='checkbox'
                        fieldValue={infiniteGrid}
                        onFieldChange={(_, v) => setInfiniteGrid(Boolean(v))}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Extend grid infinitely in all directions</div>
                </div>
            </div>
        )
    };

    const sizeSection = {
        key: 'size',
        title: 'Size & Spacing',
        enabled: true,
        rows: [
            {
                label: 'Cell Size',
                min: 0.1,
                max: 5,
                step: 0.1,
                get: () => cellSize,
                set: (v: number) => setCellSize(v),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Section Size',
                min: 1,
                max: 20,
                step: 0.5,
                get: () => sectionSize,
                set: (v: number) => setSectionSize(v),
                format: (v: number) => v.toFixed(1)
            }
        ],
        extras: null
    };

    const thicknessSection = {
        key: 'thickness',
        title: 'Line Thickness',
        enabled: true,
        rows: [
            {
                label: 'Cell Thickness',
                min: 0.1,
                max: 2,
                step: 0.1,
                get: () => cellThickness,
                set: (v: number) => setCellThickness(v),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Section Thickness',
                min: 0.1,
                max: 3,
                step: 0.1,
                get: () => sectionThickness,
                set: (v: number) => setSectionThickness(v),
                format: (v: number) => v.toFixed(1)
            }
        ],
        extras: null
    };

    const fadeSection = {
        key: 'fade',
        title: 'Fade Settings',
        enabled: true,
        rows: [
            {
                label: 'Fade Distance',
                min: 10,
                max: 500,
                step: 10,
                get: () => fadeDistance,
                set: (v: number) => setFadeDistance(v),
                format: (v: number) => v.toFixed(0)
            },
            {
                label: 'Fade Strength',
                min: 0.1,
                max: 10,
                step: 0.1,
                get: () => fadeStrength,
                set: (v: number) => setFadeStrength(v),
                format: (v: number) => v.toFixed(1)
            }
        ],
        extras: null
    };

    const colorSection = {
        key: 'color',
        title: 'Colors',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <FormField
                        fieldKey='sectionColor'
                        label='Section Color'
                        fieldType='color'
                        fieldValue={sectionColor}
                        onFieldChange={(_, v) => setSectionColor(String(v))}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Color of major grid lines(sections)</div>
                </div>
                <div>
                    <FormField
                        fieldKey='cellColor'
                        label='Cell Color'
                        fieldType='color'
                        fieldValue={cellColor}
                        onFieldChange={(_, v) => setCellColor(String(v))}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Color of minor grid lines(cells)</div>
                </div>
            </div>
        )
    };

    const transformSection = {
        key: 'transform',
        title: 'Transform',
        enabled: true,
        rows: [
            {
                label: 'Position X',
                min: -50,
                max: 50,
                step: 0.1,
                get: () => position[0],
                set: (v: number) => setPosition([v, position[1], position[2]]),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Position Y',
                min: -50,
                max: 50,
                step: 0.1,
                get: () => position[1],
                set: (v: number) => setPosition([position[0], v, position[2]]),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Position Z',
                min: -50,
                max: 50,
                step: 0.1,
                get: () => position[2],
                set: (v: number) => setPosition([position[0], position[1], v]),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Rotation X(rad)',
                min: -Math.PI,
                max: Math.PI,
                step: 0.1,
                get: () => rotation[0],
                set: (v: number) => setRotation([v, rotation[1], rotation[2]]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Rotation Y(rad)',
                min: -Math.PI,
                max: Math.PI,
                step: 0.1,
                get: () => rotation[1],
                set: (v: number) => setRotation([rotation[0], v, rotation[2]]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Rotation Z(rad)',
                min: -Math.PI,
                max: Math.PI,
                step: 0.1,
                get: () => rotation[2],
                set: (v: number) => setRotation([rotation[0], rotation[1], v]),
                format: (v: number) => v.toFixed(2)
            }
        ],
        extras: null
    };

    return (
        <SettingsPanel
            title='Canvas Grid'
            icon={<IoGridOutline size={16} />}
            subsections={[
                { label: 'General Settings', icon: <MdSettings size={14} />, sections: [generalSection] },
                { label: 'Size & Spacing', icon: <IoGridOutline size={14} />, sections: [sizeSection] },
                { label: 'Line Thickness', icon: <MdStraighten size={14} />, sections: [thicknessSection] },
                { label: 'Fade Settings', icon: <MdOpacity size={14} />, sections: [fadeSection] },
                { label: 'Colors', icon: <MdColorLens size={14} />, sections: [colorSection] },
                { label: 'Transform', icon: <MdTransform size={14} />, sections: [transformSection] }
            ]}
        />
    );
};

export default CanvasGridControls;
