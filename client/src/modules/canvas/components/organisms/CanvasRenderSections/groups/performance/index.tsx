import { selectField } from '../../../../molecules/CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useMemo } from 'react';
import { MdSpeed } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import Container from '@/shared/presentation/components/Container';
import Select from '@/shared/presentation/components/Select';
import { PerformancePreset, PowerPreference } from '@/modules/fractal/stores/contracts/editor/performance-types';
import { isEnumValue } from '../../utilities';

import type { RenderGroup } from '../../types';

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
                                onChange={(value: string) => {
                                    if (isEnumValue(value, PerformancePreset)) {
                                        s.setPreset(value);
                                    }
                                }}
                                placeholder="Preset"
                                options={[
                                    { title: 'Ultra', value: PerformancePreset.Ultra },
                                    { title: 'High', value: PerformancePreset.High },
                                    { title: 'Balanced', value: PerformancePreset.Balanced },
                                    { title: 'Performance', value: PerformancePreset.Performance },
                                    { title: 'Battery Saver', value: PerformancePreset.Battery }
                                ]}
                            />
                            {selectField('powerPref', s.canvas.powerPreference, (value: string) => {
                                if (isEnumValue(value, PowerPreference)) {
                                    s.setCanvas({ powerPreference: value });
                                }
                            }, 'GPU Power', [
                                { title: 'Default', value: PowerPreference.Default },
                                { title: 'High Performance', value: PowerPreference.HighPerformance },
                                { title: 'Low Power', value: PowerPreference.LowPower }
                            ])}
                        </Container>
                    )
                }]
            }
        ]
    }), [s]);
};

export default usePerformanceGroup;
