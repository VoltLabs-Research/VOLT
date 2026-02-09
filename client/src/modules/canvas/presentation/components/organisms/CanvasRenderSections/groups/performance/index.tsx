import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdSpeed, MdTune, MdHighQuality, MdTouchApp } from 'react-icons/md';
import { IoHardwareChipOutline } from 'react-icons/io5';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Select from '@/shared/presentation/components/Select';
import { row, PRESETS, checkboxGrid } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';
import type { PerformancePreset } from '@/modules/fractal/presentation/types/stores/editor/performance-types';

const usePerformanceGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.performanceSettings));

    return useMemo(() => {
        const sections = {
            preset: {
                key: 'preset', title: 'Performance Preset', enabled: true,
                rows: [],
                extras: (
                    <Select
                        value={s.preset}
                        onChange={(v: string) => s.setPreset(v as PerformancePreset)}
                        placeholder="Preset"
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
                key: 'dpr', title: 'DPR & Resolution', enabled: true,
                rows: [
                    row({ ...PRESETS.dpr('Min DPR'), max: Math.max(3, s.dpr.max) }, () => s.dpr.min, (v: number) => s.setDpr({ min: v })),
                    row({ ...PRESETS.dpr('Max DPR'), min: Math.min(0.5, s.dpr.min) }, () => s.dpr.max, (v: number) => s.setDpr({ max: v })),
                    row(PRESETS.dpr('Fixed DPR'), () => s.dpr.fixed, (v: number) => s.setDpr({ fixed: v })),
                    row(PRESETS.dpr('Interaction Min DPR'), () => s.dpr.interactionMin, (v: number) => s.setDpr({ interactionMin: v }))
                ],
                extras: (
                    <>
                        <Select
                            value={s.dpr.mode}
                            onChange={(v: string) => s.setDpr({ mode: v as 'fixed' | 'adaptive' })}
                            placeholder="Mode"
                            options={[
                                { title: 'Adaptive', value: 'adaptive' },
                                { title: 'Fixed', value: 'fixed' }
                            ]}
                        />
                        {checkboxGrid([
                            { key: 'pixelated', label: 'Pixelated', value: s.dpr.pixelated, onChange: (v: boolean) => s.setDpr({ pixelated: v }) },
                            { key: 'snap', label: 'Snap', value: s.dpr.snap, onChange: (v: boolean) => s.setDpr({ snap: v }) }
                        ])}
                    </>
                )
            },
            canvas: {
                key: 'canvas', title: 'Canvas & Performance', enabled: true,
                rows: [
                    row(PRESETS.perf('Perf Current'), () => s.performance.current, (v: number) => s.setPerformance({ current: v })),
                    row(PRESETS.perf('Perf Min'), () => s.performance.min, (v: number) => s.setPerformance({ min: v })),
                    row(PRESETS.perf('Perf Max'), () => s.performance.max, (v: number) => s.setPerformance({ max: v })),
                    row(PRESETS.debounce('Perf Debounce(ms)'), () => s.performance.debounce, (v: number) => s.setPerformance({ debounce: Math.round(v) }))
                ],
                extras: (
                    <Select
                        value={s.canvas.powerPreference}
                        onChange={(v: string) => s.setCanvas({ powerPreference: v as 'default' | 'high-performance' | 'low-power' })}
                        placeholder="Power Preference"
                        options={[
                            { title: 'Default', value: 'default' },
                            { title: 'High Performance', value: 'high-performance' },
                            { title: 'Low Power', value: 'low-power' }
                        ]}
                    />
                )
            },
            adaptive: {
                key: 'adaptive', title: 'Adaptive & Interaction', enabled: true,
                rows: [
                    row(PRESETS.debounce('Interaction Debounce(ms)', 400), () => s.interactionDegrade.debounceMs, (v: number) => s.setInteractionDegrade({ debounceMs: Math.round(v) }))
                ],
                extras: checkboxGrid([
                    { key: 'adaptiveEvents', label: 'Adaptive Events', value: s.adaptiveEvents.enabled, onChange: (v: boolean) => s.setAdaptiveEvents({ enabled: v }) },
                    { key: 'interactionDegrade', label: 'Interaction Degrade', value: s.interactionDegrade.enabled, onChange: (v: boolean) => s.setInteractionDegrade({ enabled: v }) }
                ])
            }
        };

        return {
            id: 'performance', title: 'Performance',
            icon: <MdSpeed size={12} />,
            subsections: [
                { label: 'Performance Presets', icon: <MdTune size={14} />, sections: [sections.preset] },
                { label: 'Device Pixel Ratio (DPR)', icon: <IoHardwareChipOutline size={14} />, sections: [sections.dpr] },
                { label: 'Canvas & Performance', icon: <MdHighQuality size={14} />, sections: [sections.canvas] },
                { label: 'Adaptive & Interaction', icon: <MdTouchApp size={14} />, sections: [sections.adaptive] }
            ]
        };
    }, [s]);
};

export default usePerformanceGroup;
