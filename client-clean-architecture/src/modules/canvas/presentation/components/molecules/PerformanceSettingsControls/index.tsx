import React from 'react';
import Select from '@/shared/presentation/components/Select';
import FormField from '@/shared/presentation/components/FormField';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { MdSpeed, MdHighQuality, MdTouchApp, MdTune } from 'react-icons/md';
import { IoHardwareChipOutline } from 'react-icons/io5';

const PerformanceSettingsControls: React.FC = () => {
    const {
        preset,
        dpr,
        canvas,
        performance,
        adaptiveEvents,
        interactionDegrade,
        setPreset,
        setDpr,
        setCanvas,
        setPerformance,
        setAdaptiveEvents,
        setInteractionDegrade
    } = useEditorStore(useShallow((s) => s.performanceSettings));

    const presetSection = {
        key: 'preset',
        title: 'Performance Preset',
        enabled: true,
        rows: [],
        extras: (
            <Select
                value={preset}
                onChange={(value) => setPreset(value as typeof preset)}
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
    };

    const dprSection = {
        key: 'dpr',
        title: 'DPR & Resolution',
        enabled: true,
        rows: [
            {
                label: 'Min DPR',
                min: 0.5,
                max: Math.max(3, dpr.max),
                step: 0.05,
                get: () => dpr.min,
                set: (v: number) => setDpr({ min: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Max DPR',
                min: Math.min(0.5, dpr.min),
                max: 3,
                step: 0.05,
                get: () => dpr.max,
                set: (v: number) => setDpr({ max: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Fixed DPR',
                min: 0.5,
                max: 3,
                step: 0.05,
                get: () => dpr.fixed,
                set: (v: number) => setDpr({ fixed: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Interaction Min DPR',
                min: 0.5,
                max: 3,
                step: 0.05,
                get: () => dpr.interactionMin,
                set: (v: number) => setDpr({ interactionMin: v }),
                format: (v: number) => v.toFixed(2)
            }
        ],
        extras: (
            <>
                <Select
                    value={dpr.mode}
                    onChange={(value) => setDpr({ mode: value as 'fixed' | 'adaptive' })}
                    placeholder='Mode'
                    options={[
                        { title: 'Adaptive', value: 'adaptive' },
                        { title: 'Fixed', value: 'fixed' }
                    ]}
                />
                <div style={{ display: 'grid', gap: 8 }}>
                    <FormField
                        fieldKey='pixelated'
                        label='Pixelated'
                        fieldType='checkbox'
                        fieldValue={dpr.pixelated}
                        onFieldChange={(_, v) => setDpr({ pixelated: Boolean(v) })}
                    />
                    <FormField
                        fieldKey='snap'
                        label='Snap'
                        fieldType='checkbox'
                        fieldValue={dpr.snap}
                        onFieldChange={(_, v) => setDpr({ snap: Boolean(v) })}
                    />
                </div>
            </>
        )
    };

    const canvasPerfSection = {
        key: 'canvas',
        title: 'Canvas & Performance',
        enabled: true,
        rows: [
            {
                label: 'Perf Current',
                min: 0.1,
                max: 1,
                step: 0.05,
                get: () => performance.current,
                set: (v: number) => setPerformance({ current: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Perf Min',
                min: 0.1,
                max: 1,
                step: 0.05,
                get: () => performance.min,
                set: (v: number) => setPerformance({ min: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Perf Max',
                min: 0.1,
                max: 1,
                step: 0.05,
                get: () => performance.max,
                set: (v: number) => setPerformance({ max: v }),
                format: (v: number) => v.toFixed(2)
            },
            {
                label: 'Perf Debounce(ms)',
                min: 0,
                max: 300,
                step: 5,
                get: () => performance.debounce,
                set: (v: number) => setPerformance({ debounce: Math.round(v) }),
                format: (v: number) => `${Math.round(v)}`
            }
        ],
        extras: (
            <Select
                value={canvas.powerPreference}
                onChange={(value) => setCanvas({ powerPreference: value as 'default' | 'high-performance' | 'low-power' })}
                placeholder='Power Preference'
                options={[
                    { title: 'Default', value: 'default' },
                    { title: 'High Performance', value: 'high-performance' },
                    { title: 'Low Power', value: 'low-power' }
                ]}
            />
        )
    };

    const adaptiveSection = {
        key: 'adaptive',
        title: 'Adaptive & Interaction',
        enabled: true,
        rows: [
            {
                label: 'Interaction Debounce(ms)',
                min: 0,
                max: 400,
                step: 5,
                get: () => interactionDegrade.debounceMs,
                set: (v: number) => setInteractionDegrade({ debounceMs: Math.round(v) }),
                format: (v: number) => `${Math.round(v)}`
            }
        ],
        extras: (
            <div style={{ display: 'grid', gap: 8 }}>
                <FormField
                    fieldKey='adaptiveEvents'
                    label='Adaptive Events'
                    fieldType='checkbox'
                    fieldValue={adaptiveEvents.enabled}
                    onFieldChange={(_, enabled) => setAdaptiveEvents({ enabled: Boolean(enabled) })}
                />
                <FormField
                    fieldKey='interactionDegrade'
                    label='Interaction Degrade'
                    fieldType='checkbox'
                    fieldValue={interactionDegrade.enabled}
                    onFieldChange={(_, enabled) => setInteractionDegrade({ enabled: Boolean(enabled) })}
                />
            </div>
        )
    };

    return (
        <SettingsPanel
            title='Performance Settings'
            icon={<MdSpeed size={16} />}
            subsections={[
                { label: 'Performance Presets', icon: <MdTune size={14} />, sections: [presetSection] },
                { label: 'Device Pixel Ratio (DPR)', icon: <IoHardwareChipOutline size={14} />, sections: [dprSection] },
                { label: 'Canvas & Performance', icon: <MdHighQuality size={14} />, sections: [canvasPerfSection] },
                { label: 'Adaptive & Interaction', icon: <MdTouchApp size={14} />, sections: [adaptiveSection] }
            ]}
        />
    );
};

export default PerformanceSettingsControls;
