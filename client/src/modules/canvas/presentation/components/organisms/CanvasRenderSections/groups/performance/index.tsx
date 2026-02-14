import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdSpeed } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Select from '@/shared/presentation/components/Select';
import Container from '@/shared/presentation/components/Container';
import { selectField } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';
import type { PerformancePreset } from '@/modules/fractal/presentation/types/stores/editor/performance-types';

const usePerformanceGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.performanceSettings));

    return useMemo(() => ({
        id: 'performance', title: 'Performance',
        icon: <MdSpeed size={12} />,
        subsections: [
            {
                label: 'Performance Preset',
                sections: [{
                    key: 'preset', title: 'Performance Preset', enabled: true,
                    rows: [],
                    extras: (
                        <Container className="canvas-render-grid">
                            <Select
                                value={s.preset}
                                onChange={(v: string) => s.setPreset(v as PerformancePreset)}
                                placeholder="Preset"
                                options={[
                                    { title: 'Ultra', value: 'ultra' },
                                    { title: 'High', value: 'high' },
                                    { title: 'Balanced', value: 'balanced' },
                                    { title: 'Performance', value: 'performance' },
                                    { title: 'Battery Saver', value: 'battery' }
                                ]}
                            />
                            {selectField('powerPref', s.canvas.powerPreference, (v: string) => s.setCanvas({ powerPreference: v as 'default' | 'high-performance' | 'low-power' }), 'GPU Power', [
                                { title: 'Default', value: 'default' },
                                { title: 'High Performance', value: 'high-performance' },
                                { title: 'Low Power', value: 'low-power' }
                            ])}
                        </Container>
                    )
                }]
            }
        ]
    }), [s]);
};

export default usePerformanceGroup;
