import React, { memo } from 'react';
import Select from '@/shared/presentation/components/Select';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { MdSpeed, MdHighQuality, MdTouchApp, MdTune } from 'react-icons/md';
import { IoHardwareChipOutline } from 'react-icons/io5';
import { row, PRESETS, checkboxGrid } from '../controls/config-helpers';

const PerformanceSettingsControls: React.FC = () => {
    const s = useEditorStore(useShallow((s) => s.performanceSettings));

    const sections = {
        preset: {
            key: 'preset',
            title: 'Performance Preset',
            enabled: true,
            rows: [],
            extras: (
                <Select
                    value={s.preset}
                    onChange={(v) => s.setPreset(v as typeof s.preset)}
                    placeholder='Preset'
                    options={[
                        { title: 'Ultra', value: 'ultra' },
                        { title: 'High', value: 'high' },
                        { title: 'Balanced', value: 'balanced' },
                        { title: 'Performance', value: 'performance' },
                        { title: 'Battery', value: 'battery' }
                    ]}
                />
            )
        },
        dpr: {
            key: 'dpr',
            title: 'DPR & Resolution',
            enabled: true,
            rows: [
                row({ ...PRESETS.dpr('Min DPR'), max: Math.max(3, s.dpr.max) }, () => s.dpr.min, (v) => s.setDpr({ min: v })),
                row({ ...PRESETS.dpr('Max DPR'), min: Math.min(0.5, s.dpr.min) }, () => s.dpr.max, (v) => s.setDpr({ max: v })),
                row(PRESETS.dpr('Fixed DPR'), () => s.dpr.fixed, (v) => s.setDpr({ fixed: v })),
                row(PRESETS.dpr('Interaction Min DPR'), () => s.dpr.interactionMin, (v) => s.setDpr({ interactionMin: v }))
            ],
            extras: (
                <>
                    <Select
                        value={s.dpr.mode}
                        onChange={(v) => s.setDpr({ mode: v as 'fixed' | 'adaptive' })}
                        placeholder='Mode'
                        options={[
                            { title: 'Adaptive', value: 'adaptive' },
                            { title: 'Fixed', value: 'fixed' }
                        ]}
                    />
                    {checkboxGrid([
                        { key: 'pixelated', label: 'Pixelated', value: s.dpr.pixelated, onChange: (v) => s.setDpr({ pixelated: v }) },
                        { key: 'snap', label: 'Snap', value: s.dpr.snap, onChange: (v) => s.setDpr({ snap: v }) }
                    ])}
                </>
            )
        },
        canvas: {
            key: 'canvas',
            title: 'Canvas & Performance',
            enabled: true,
            rows: [
                row(PRESETS.perf('Perf Current'), () => s.performance.current, (v) => s.setPerformance({ current: v })),
                row(PRESETS.perf('Perf Min'), () => s.performance.min, (v) => s.setPerformance({ min: v })),
                row(PRESETS.perf('Perf Max'), () => s.performance.max, (v) => s.setPerformance({ max: v })),
                row(PRESETS.debounce('Perf Debounce(ms)'), () => s.performance.debounce, (v) => s.setPerformance({ debounce: Math.round(v) }))
            ],
            extras: (
                <Select
                    value={s.canvas.powerPreference}
                    onChange={(v) => s.setCanvas({ powerPreference: v as 'default' | 'high-performance' | 'low-power' })}
                    placeholder='Power Preference'
                    options={[
                        { title: 'Default', value: 'default' },
                        { title: 'High Performance', value: 'high-performance' },
                        { title: 'Low Power', value: 'low-power' }
                    ]}
                />
            )
        },
        adaptive: {
            key: 'adaptive',
            title: 'Adaptive & Interaction',
            enabled: true,
            rows: [
                row(PRESETS.debounce('Interaction Debounce(ms)', 400), () => s.interactionDegrade.debounceMs, (v) => s.setInteractionDegrade({ debounceMs: Math.round(v) }))
            ],
            extras: checkboxGrid([
                { key: 'adaptiveEvents', label: 'Adaptive Events', value: s.adaptiveEvents.enabled, onChange: (v) => s.setAdaptiveEvents({ enabled: v }) },
                { key: 'interactionDegrade', label: 'Interaction Degrade', value: s.interactionDegrade.enabled, onChange: (v) => s.setInteractionDegrade({ enabled: v }) }
            ])
        }
    };

    return (
        <SettingsPanel
            title='Performance Settings'
            icon={<MdSpeed size={16} />}
            subsections={[
                { label: 'Performance Presets', icon: <MdTune size={14} />, sections: [sections.preset] },
                { label: 'Device Pixel Ratio (DPR)', icon: <IoHardwareChipOutline size={14} />, sections: [sections.dpr] },
                { label: 'Canvas & Performance', icon: <MdHighQuality size={14} />, sections: [sections.canvas] },
                { label: 'Adaptive & Interaction', icon: <MdTouchApp size={14} />, sections: [sections.adaptive] }
            ]}
        />
    );
};

export default memo(PerformanceSettingsControls);
