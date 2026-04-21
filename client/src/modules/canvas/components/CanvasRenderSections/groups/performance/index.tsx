import { selectField } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import {
    isPerformancePreset,
    isPowerPreference,
    PERFORMANCE_PRESET_OPTIONS,
    POWER_PREFERENCE_OPTIONS
} from '@/shared/domain/rendering/performance';
import Select from '@/shared/presentation/components/Select';
import { useMemo } from 'react';
import { MdSpeed } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';

import type { RenderGroup } from '../../types';

const usePerformanceGroup = (): RenderGroup => {
    const { performanceSettings, rendererSettings } = useEditorStore(useShallow((state) => ({
        performanceSettings: state.performanceSettings,
        rendererSettings: state.rendererSettings
    })));

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
                        <div className='volt-container canvas-render-grid'>
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
