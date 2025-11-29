import React from 'react';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/form/FormField';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import useCanvasGridSettings from '@/stores/editor/canvas-grid-settings';
import { MdSettings, MdStraighten, MdOpacity, MdColorLens, MdTransform } from 'react-icons/md';
import { IoGridOutline } from 'react-icons/io5';

const CanvasGridControls: React.FC = () => {
    const settings = useCanvasGridSettings();
    const {
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
        onToggle: () => {},
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <FormField 
                        fieldKey="enabled" 
                        label="Enabled" 
                        fieldType="checkbox" 
                        fieldValue={enabled} 
                        onFieldChange={(_, v) => settings.setEnabled(Boolean(v))} 
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Show/hide the canvas grid</div>
                </div>
                <div>
                    <FormField 
                        fieldKey="infiniteGrid" 
                        label="Infinite Grid" 
                        fieldType="checkbox" 
                        fieldValue={infiniteGrid} 
                        onFieldChange={(_, v) => settings.setInfiniteGrid(Boolean(v))} 
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
        onToggle: () => {},
        rows: [
            {
                label: 'Cell Size',
                min: 0.1,
                max: 5,
                step: 0.1,
                get: () => cellSize,
                set: (v: number) => settings.setCellSize(v),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Section Size',
                min: 1,
                max: 20,
                step: 0.5,
                get: () => sectionSize,
                set: (v: number) => settings.setSectionSize(v),
                format: (v: number) => v.toFixed(1)
            }
        ],
        extras: null
    };

    const thicknessSection = {
        key: 'thickness',
        title: 'Line Thickness',
        enabled: true,
        onToggle: () => {},
        rows: [
            {
                label: 'Cell Thickness',
                min: 0.1,
                max: 2,
                step: 0.1,
                get: () => cellThickness,
                set: (v: number) => settings.setCellThickness(v),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Section Thickness',
                min: 0.1,
                max: 3,
                step: 0.1,
                get: () => sectionThickness,
                set: (v: number) => settings.setSectionThickness(v),
                format: (v: number) => v.toFixed(1)
            }
        ],
        extras: null
    };

    const fadeSection = {
        key: 'fade',
        title: 'Fade Settings',
        enabled: true,
        onToggle: () => {},
        rows: [
            {
                label: 'Fade Distance',
                min: 10,
                max: 500,
                step: 10,
                get: () => fadeDistance,
                set: (v: number) => settings.setFadeDistance(v),
                format: (v: number) => v.toFixed(0)
            },
            {
                label: 'Fade Strength',
                min: 0.1,
                max: 10,
                step: 0.1,
                get: () => fadeStrength,
                set: (v: number) => settings.setFadeStrength(v),
                format: (v: number) => v.toFixed(1)
            }
        ],
        extras: null
    };

    const colorSection = {
        key: 'color',
        title: 'Colors',
        enabled: true,
        onToggle: () => {},
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <FormField 
                        fieldKey="sectionColor" 
                        label="Section Color" 
                        fieldType="color" 
                        fieldValue={sectionColor} 
                        onFieldChange={(_, v) => settings.setSectionColor(String(v))} 
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Color of major grid lines (sections)</div>
                </div>
                <div>
                    <FormField 
                        fieldKey="cellColor" 
                        label="Cell Color" 
                        fieldType="color" 
                        fieldValue={cellColor} 
                        onFieldChange={(_, v) => settings.setCellColor(String(v))} 
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Color of minor grid lines (cells)</div>
                </div>
            </div>
        )
    };

    const transformSection = {
        key: 'transform',
        title: 'Transform',
        enabled: true,
        onToggle: () => {},
        rows: [
            {
                label: 'Position X',
                min: -50,
                max: 50,
                step: 0.1,
                get: () => position[0],
                set: (v: number) => settings.setPosition([v, position[1], position[2]]),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Position Y',
                min: -50,
                max: 50,
                step: 0.1,
                get: () => position[1],
                set: (v: number) => settings.setPosition([position[0], v, position[2]]),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Position Z',
                min: -50,
                max: 50,
                step: 0.1,
                get: () => position[2],
                set: (v: number) => settings.setPosition([position[0], position[1], v]),
                format: (v: number) => v.toFixed(1)
            },
            {
                label: 'Rotation X (rad)',
                min: -Math.PI,
                max: Math.PI,
                step: 0.1,
                get: () => rotation[0],
                set: (v: number) => settings.setRotation([v, rotation[1], rotation[2]]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Rotation Y (rad)',
                min: -Math.PI,
                max: Math.PI,
                step: 0.1,
                get: () => rotation[1],
                set: (v: number) => settings.setRotation([rotation[0], v, rotation[2]]),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Rotation Z (rad)',
                min: -Math.PI,
                max: Math.PI,
                step: 0.1,
                get: () => rotation[2],
                set: (v: number) => settings.setRotation([rotation[0], rotation[1], v]),
                format: (v: number) => v.toFixed(2)
            }
        ],
        extras: null
    };

    return (
        <CollapsibleSection 
            title="Canvas Grid" 
            icon={<IoGridOutline size={16} />}
        >
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MdSettings size={14} />
                        General Settings
                    </div>
                    <FormSchema sections={[generalSection]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IoGridOutline size={14} />
                        Size & Spacing
                    </div>
                    <FormSchema sections={[sizeSection]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MdStraighten size={14} />
                        Line Thickness
                    </div>
                    <FormSchema sections={[thicknessSection]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MdOpacity size={14} />
                        Fade Settings
                    </div>
                    <FormSchema sections={[fadeSection]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MdColorLens size={14} />
                        Colors
                    </div>
                    <FormSchema sections={[colorSection]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MdTransform size={14} />
                        Transform
                    </div>
                    <FormSchema sections={[transformSection]} />
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default CanvasGridControls;
