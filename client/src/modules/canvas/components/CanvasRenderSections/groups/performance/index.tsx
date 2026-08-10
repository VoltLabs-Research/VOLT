import { selectField } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/store/editor';
import {
    isPerformancePreset,
    isPowerPreference,
    PERFORMANCE_PRESET_OPTIONS,
    POWER_PREFERENCE_OPTIONS
} from '@/shared/rendering/performance';
import { Select } from '@voltstack/bravais';
import { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import type { RenderGroup } from '@/modules/canvas/contracts/render-sections';

const usePerformanceGroup = (): RenderGroup => {
    const { performanceSettings, rendererSettings } = useEditorStore(useShallow((state) => ({
        performanceSettings: state.performanceSettings,
        rendererSettings: state.rendererSettings
    })));

    return useMemo(() => ({
        id: 'performance',
        title: 'Performance',
        icon: <Gauge size={12} />,
        subsections: [
            {
                label: 'Performance Preset',
                sections: [{
                    key: 'preset',
                    title: 'Performance Preset',
                    enabled: true,
                    rows: [],
                    extras: (
                        <div className='canvas-render-grid'>
                            <Select
                                value={performanceSettings.preset}
                                onChange={(value: string) => {
                                    if (isPerformancePreset(value)) {
                                        performanceSettings.setPreset(value);
                                    }
                                }}
                                placeholder='Preset'
                                options={PERFORMANCE_PRESET_OPTIONS}
                            />
                            {selectField('powerPref', rendererSettings.create.powerPreference, (value: string) => {
                                if (isPowerPreference(value)) {
                                    rendererSettings.setCreate({ powerPreference: value });
                                }
                            }, 'GPU Power', POWER_PREFERENCE_OPTIONS)}
                        </div>
                    )
                }]
            }
        ]
    }), [performanceSettings, rendererSettings]);
};

export default usePerformanceGroup;
