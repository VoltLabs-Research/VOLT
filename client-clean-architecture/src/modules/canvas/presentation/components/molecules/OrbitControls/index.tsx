import React, { memo } from 'react';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import Button from '@/shared/presentation/components/Button';
import { MdRotateLeft } from 'react-icons/md';
import { row, PRESETS, targetRows, checkboxGrid, checkbox } from '../controls/config-helpers';

const OrbitControls: React.FC = () => {
    const s = useEditorStore(useShallow((s) => s.orbitControls));

    const sections = {
        general: {
            key: 'general',
            title: 'OrbitControls',
            enabled: true,
            rows: [],
            extras: (
                <div style={{ display: 'grid', gap: 8 }}>
                    {checkboxGrid([
                        { key: 'enabled', label: 'Enabled', value: s.enabled, onChange: (v) => s.set({ enabled: v }) },
                        { key: 'autoRotate', label: 'Auto Rotate', value: s.autoRotate, onChange: (v) => s.set({ autoRotate: v }) },
                        { key: 'enableDamping', label: 'Enable Damping', value: s.enableDamping, onChange: (v) => s.set({ enableDamping: v }) },
                        { key: 'enableZoom', label: 'Enable Zoom', value: s.enableZoom, onChange: (v) => s.set({ enableZoom: v }) },
                        { key: 'enableRotate', label: 'Enable Rotate', value: s.enableRotate, onChange: (v) => s.set({ enableRotate: v }) },
                        { key: 'enablePan', label: 'Enable Pan', value: s.enablePan, onChange: (v) => s.set({ enablePan: v }) }
                    ])}
                    <Button variant='ghost' intent='neutral' size='sm' onClick={() => s.reset()} style={{ justifySelf: 'start' }}>
                        Reset Orbit
                    </Button>
                </div>
            )
        },
        speeds: {
            key: 'speeds',
            title: 'Speeds',
            enabled: true,
            rows: [
                row(PRESETS.speed('Rotate Speed'), () => s.rotateSpeed, (v) => s.set({ rotateSpeed: v })),
                row(PRESETS.speed('Zoom Speed'), () => s.zoomSpeed, (v) => s.set({ zoomSpeed: v })),
                row(PRESETS.speed('Pan Speed'), () => s.panSpeed, (v) => s.set({ panSpeed: v })),
                row(PRESETS.speed('Auto Rotate Speed', 20), () => s.autoRotateSpeed, (v) => s.set({ autoRotateSpeed: v })),
                row(PRESETS.factor('Damping Factor'), () => s.dampingFactor, (v) => s.set({ dampingFactor: v }))
            ],
            extras: checkbox('screenSpacePanning', 'Screen Space Panning', s.screenSpacePanning, (v) => s.set({ screenSpacePanning: v }))
        },
        limits: {
            key: 'limits',
            title: 'Limits',
            enabled: true,
            rows: [
                row({ label: 'Min Distance', min: 0.001, max: Math.max(10, s.maxDistance), step: 0.001, decimals: 3 }, () => s.minDistance, (v) => s.set({ minDistance: v })),
                row({ label: 'Max Distance', min: Math.max(0.001, s.minDistance + 0.001), max: 100000, step: 0.1, decimals: 1 }, () => s.maxDistance, (v) => s.set({ maxDistance: v })),
                row({ label: 'Min Polar(rad)', min: 0, max: Math.PI, step: 0.001, decimals: 3 }, () => s.minPolarAngle, (v) => s.set({ minPolarAngle: v })),
                row({ label: 'Max Polar(rad)', min: 0, max: Math.PI, step: 0.001, decimals: 3 }, () => s.maxPolarAngle, (v) => s.set({ maxPolarAngle: v })),
                row({ label: 'Min Azimuth(rad)', min: -Math.PI * 1000, max: Math.PI * 1000, step: 0.001, decimals: 3 }, () => s.minAzimuthAngle, (v) => s.set({ minAzimuthAngle: v })),
                row({ label: 'Max Azimuth(rad)', min: -Math.PI * 1000, max: Math.PI * 1000, step: 0.001, decimals: 3 }, () => s.maxAzimuthAngle, (v) => s.set({ maxAzimuthAngle: v }))
            ],
            extras: null
        },
        target: {
            key: 'target',
            title: 'Target(Z-up)',
            enabled: true,
            rows: targetRows(() => s.target, s.setTarget),
            extras: null
        }
    };

    return (
        <SettingsPanel
            title='Orbit Controls'
            icon={<MdRotateLeft size={16} />}
            subsections={[
                { label: 'General Settings', sections: [sections.general] },
                { label: 'Movement Speeds', sections: [sections.speeds] },
                { label: 'Distance & Angle Limits', sections: [sections.limits] },
                { label: 'Target Position', sections: [sections.target] }
            ]}
        />
    );
};

export default memo(OrbitControls);
