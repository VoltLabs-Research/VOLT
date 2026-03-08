import { row, colorField } from '../../../../molecules/CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useMemo } from 'react';
import { MdNature } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import Select from '@/shared/presentation/components/Select';

import type { RenderGroup } from '../../types';

const useEnvironmentGroup = (): RenderGroup => {
    const s = useEditorStore(useShallow((state) => state.environment));

    return useMemo(() => {
        const sections = {
            background: {
                key: 'background', title: 'Background & Environment', enabled: true,
                rows: [
                    row({ label: 'Exposure', min: 0, max: 10, step: 0.1, decimals: 1 }, () => s.toneMappingExposure, (v: number) => s.setToneMappingExposure(v))
                ],
                extras: (
                    <>
                        <Select
                            value={s.backgroundType}
                            onChange={(v: string) => s.setBackgroundType(v as 'color' | 'environment')}
                            placeholder="Background type"
                            options={[
                                { title: 'Color', value: 'color' },
                                { title: 'Environment', value: 'environment' }
                            ]}
                        />
                        {s.backgroundType === 'color' ? (
                            colorField('backgroundColor', 'Background Color', s.backgroundColor, (v: string) => s.setBackgroundColor(v))
                        ) : (
                            <Select
                                value={s.environmentPreset}
                                onChange={(v: string) => s.setEnvironmentPreset(String(v))}
                                placeholder="Environment preset"
                                options={[
                                    { title: 'Studio', value: 'studio' },
                                    { title: 'City', value: 'city' },
                                    { title: 'Dawn', value: 'dawn' },
                                    { title: 'Sunset', value: 'sunset' },
                                    { title: 'Night', value: 'night' },
                                    { title: 'Forest', value: 'forest' }
                                ]}
                            />
                        )}
                    </>
                )
            },
            fog: {
                key: 'fog', title: 'Fog', enabled: s.enableFog,
                onToggle: (enabled: boolean) => s.setFogConfig({ enableFog: enabled }),
                rows: [
                    row({ label: 'Near', min: 0, max: Math.max(10, s.fogFar), step: 0.1, decimals: 2 }, () => s.fogNear, (v: number) => s.setFogConfig({ fogNear: Math.min(v, s.fogFar) })),
                    row({ label: 'Far', min: Math.max(0, s.fogNear + 0.1), max: 5000, step: 0.1, decimals: 2 }, () => s.fogFar, (v: number) => s.setFogConfig({ fogFar: Math.max(v, s.fogNear + 0.1) }))
                ],
                extras: colorField('fogColor', 'Fog Color', s.fogColor, (v: string) => s.setFogConfig({ fogColor: v }))
            }
        };

        return {
            id: 'environment', title: 'Environment',
            icon: <MdNature size={12} />,
            subsections: [
                { label: 'Background & Environment', sections: [sections.background] },
                { label: 'Fog Settings', sections: [sections.fog] }
            ]
        };
    }, [s]);
};

export default useEnvironmentGroup;
