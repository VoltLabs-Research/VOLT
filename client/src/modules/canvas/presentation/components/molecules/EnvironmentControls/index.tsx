import React, { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import Select from '@/shared/presentation/components/Select';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { MdNature } from 'react-icons/md';
import { row, colorField } from '../controls/config-helpers';

const EnvironmentControls: React.FC = () => {
    const s = useEditorStore(useShallow((s) => s.environment));

    const sections = {
        background: {
            key: 'background',
            title: 'Background & Environment',
            enabled: true,
            rows: [
                row({ label: 'Tone Mapping Exposure', min: 0, max: 10, step: 0.1, decimals: 1 }, () => s.toneMappingExposure, s.setToneMappingExposure)
            ],
            extras: (
                <>
                    <Select
                        value={s.backgroundType}
                        onChange={(v) => s.setBackgroundType(v as 'color' | 'environment')}
                        placeholder='Background type'
                        options={[
                            { title: 'Color', value: 'color' },
                            { title: 'Environment', value: 'environment' }
                        ]}
                    />
                    {s.backgroundType === 'color' ? (
                        colorField('backgroundColor', 'Background Color', s.backgroundColor, s.setBackgroundColor)
                    ) : (
                        <Select
                            value={s.environmentPreset}
                            onChange={(v) => s.setEnvironmentPreset(String(v))}
                            placeholder='Environment preset'
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
            key: 'fog',
            title: 'Fog',
            enabled: s.enableFog,
            onToggle: (enabled: boolean) => s.setFogConfig({ enableFog: enabled }),
            rows: [
                row({ label: 'Near', min: 0, max: Math.max(10, s.fogFar), step: 0.1, decimals: 2 }, () => s.fogNear, (v) => s.setFogConfig({ fogNear: Math.min(v, s.fogFar) })),
                row({ label: 'Far', min: Math.max(0, s.fogNear + 0.1), max: 5000, step: 0.1, decimals: 2 }, () => s.fogFar, (v) => s.setFogConfig({ fogFar: Math.max(v, s.fogNear + 0.1) }))
            ],
            extras: colorField('fogColor', 'Fog Color', s.fogColor, (v) => s.setFogConfig({ fogColor: v }))
        }
    };

    return (
        <SettingsPanel
            title='Environment'
            icon={<MdNature size={16} />}
            subsections={[
                { label: 'Background & Environment', sections: [sections.background] },
                { label: 'Fog Settings', sections: [sections.fog] }
            ]}
        />
    );
};

export default memo(EnvironmentControls);
