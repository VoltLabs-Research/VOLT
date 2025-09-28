import React from 'react';
import Select from '@/components/atoms/form/Select';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/FormField';
import usePerformanceSettingsStore from '@/stores/editor/perfomance-settings';

const PerformanceSettingsControls: React.FC = () => {
    const preset = usePerformanceSettingsStore(s => s.preset);
    const dpr = usePerformanceSettingsStore(s => s.dpr);
    const canvas = usePerformanceSettingsStore(s => s.canvas);
    const performance = usePerformanceSettingsStore(s => s.performance);
    const adaptiveEvents = usePerformanceSettingsStore(s => s.adaptiveEvents);
    const interactionDegrade = usePerformanceSettingsStore(s => s.interactionDegrade);

    const setPreset = usePerformanceSettingsStore(s => s.setPreset);
    const setDpr = usePerformanceSettingsStore(s => s.setDpr);
    const setCanvas = usePerformanceSettingsStore(s => s.setCanvas);
    const setPerformance = usePerformanceSettingsStore(s => s.setPerformance);
    const setAdaptiveEvents = usePerformanceSettingsStore(s => s.setAdaptiveEvents);
    const setInteractionDegrade = usePerformanceSettingsStore(s => s.setInteractionDegrade);

    const presetSection = {
        key: 'preset',
        title: 'Performance Preset',
        enabled: true,
        onToggle: () => {},
        rows: [],
        extras: (
            <Select
                value={preset}
                onChange={(value) => setPreset(value as typeof preset)}
                placeholder="Preset"
                options={[
                    { title: 'Ultra', value: 'ultra' },
                    { title: 'High', value: 'high' },
                    { title: 'Balanced', value: 'balanced' },
                    { title: 'Perfomance', value: 'perfomance' },
                    { title: 'Battery', value: 'battery' },
                ]}
            />
        )
    };

    const dprSection = {
        key: 'dpr',
        title: 'DPR & Resolution',
        enabled: true,
        onToggle: () => {},
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
                    placeholder="Mode"
                    options={[
                        { title: 'Adaptive', value: 'adaptive' },
                        { title: 'Fixed', value: 'fixed' }
                    ]}
                />
                <div style={{ display: 'grid', gap: 8 }}>
                    <FormField
                        fieldKey="pixelated"
                        label="Pixelated"
                        fieldType="checkbox"
                        fieldValue={dpr.pixelated}
                        onFieldChange={(_, v) => setDpr({ pixelated: Boolean(v) })}
                    />
                    <FormField
                        fieldKey="snap"
                        label="Snap"
                        fieldType="checkbox"
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
        onToggle: () => {},
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
                label: 'Perf Debounce (ms)',
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
                onChange={(value) => setCanvas({ powerPreference: value as 'default' | 'high-perfomance' | 'low-power' })}
                placeholder="Power Preference"
                options={[
                    { title: 'Default', value: 'default' },
                    { title: 'High Perfomance', value: 'high-perfomance' },
                    { title: 'Low Power', value: 'low-power' },
                ]}
            />
        )
    };

    const adaptiveSection = {
        key: 'adaptive',
        title: 'Adaptive & Interaction',
        enabled: true,
        onToggle: () => {},
        rows: [
            {
                label: 'Interaction Debounce (ms)',
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
                    fieldKey="adaptiveEvents"
                    label="Adaptive Events"
                    fieldType="checkbox"
                    fieldValue={adaptiveEvents.enabled}
                    onFieldChange={(_, enabled) => setAdaptiveEvents({ enabled: Boolean(enabled) })}
                />
                <FormField
                    fieldKey="interactionDegrade"
                    label="Interaction Degrade"
                    fieldType="checkbox"
                    fieldValue={interactionDegrade.enabled}
                    onFieldChange={(_, enabled) => setInteractionDegrade({ enabled: Boolean(enabled) })}
                />
            </div>
        )
    };

    return (
        <div className="editor-sidebar-item-container">
            <div className="editor-sidebar-item-header-container">
                <h3 className="editor-sidebar-item-header-title">Performance Settings</h3>
            </div>

            <FormSchema
                sections={[presetSection, dprSection, canvasPerfSection, adaptiveSection]}
                className="editor-sidebar-item-body-container"
            />
        </div>
    );
};

export default PerformanceSettingsControls;
