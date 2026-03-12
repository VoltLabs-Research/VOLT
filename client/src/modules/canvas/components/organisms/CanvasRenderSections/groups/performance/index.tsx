import { selectField } from '../../../../molecules/CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import {
    isPerformancePreset,
    isPowerPreference,
    PERFORMANCE_PRESET_OPTIONS,
    POWER_PREFERENCE_OPTIONS
} from '@/shared/domain/rendering/performance';
import Container from '@/shared/presentation/components/Container';
import Select from '@/shared/presentation/components/Select';
import { useMemo } from 'react';
import { MdSpeed } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';

import type { RenderGroup } from '../../types';

const usePerformanceGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.performanceSettings));

    return useMemo(() => ({
        id: 'performance',
        title: 'Performance',
        icon: <MdSpeed size={12} />,
        subsections: [
            {
                label: 'Performance Preset',
                sections: [{
                    key: 'preset',
                    title: 'Performance Preset',
                    enabled: true,
                    rows: [],
                    extras: (
                        <Container className="canvas-render-grid">
                            <Select
                                value={s.preset}
                                onChange={(value: string) => {
                                    if (isPerformancePreset(value)) {
                                        s.setPreset(value);
                                    }
                                }}
                                placeholder="Preset"
                                options={PERFORMANCE_PRESET_OPTIONS}
                            />
                            {selectField('powerPref', s.canvas.powerPreference, (value: string) => {
                                if (isPowerPreference(value)) {
                                    s.setCanvas({ powerPreference: value });
                                }
                            }, 'GPU Power', POWER_PREFERENCE_OPTIONS)}
                        </Container>
                    )
                }]
            }
        ]
    }), [s]);
};

export default usePerformanceGroup;
