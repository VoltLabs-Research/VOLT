import React from 'react';
import useEnvironmentConfigStore from '@/stores/editor/environment-config';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/FormField';
import Select from '@/components/atoms/form/Select';
import CollapsibleSection from '@/components/atoms/CollapsibleSection';
import { MdNature } from 'react-icons/md';

const EnvironmentControls: React.FC = () => {
    const {
        backgroundColor,
        backgroundType,
        environmentPreset,
        enableFog,
        fogColor,
        fogNear,
        fogFar,
        toneMappingExposure,
        setBackgroundColor,
        setBackgroundType,
        setEnvironmentPreset,
        setFogConfig,
        setToneMappingExposure,
    } = useEnvironmentConfigStore();

    const backgroundSection = {
        key: 'background',
        title: 'Background & Environment',
        enabled: true,
        onToggle: () => {},
        rows: [{
            label: 'Tone Mapping Exposure',
            min: 0,
            max: 10,
            step: 0.1,
            get: () => toneMappingExposure,
            set: (v: number) => setToneMappingExposure(v),
            format: (v: number) => v.toFixed(1)
        }],
        extras: (
            <>
                <Select
                    value={backgroundType}
                    onChange={(value) => setBackgroundType(value as 'color' | 'environment')}
                    placeholder="Background type"
                    options={[
                        { title: 'Color', value: 'color' },
                        { title: 'Environment', value: 'environment' },
                    ]}
                />

                {backgroundType === 'color' ? (
                    <FormField
                        fieldKey="backgroundColor"
                        label="Background Color"
                        fieldType="color"
                        fieldValue={backgroundColor}
                        onFieldChange={(_, color) => setBackgroundColor(color as string)}
                    />
                    ) : (
                    <Select
                        value={environmentPreset}
                        onChange={(value) => setEnvironmentPreset(String(value))}
                        placeholder="Environment preset"
                        options={[
                            { title: 'Studio', value: 'studio' },
                            { title: 'City', value: 'city' },
                            { title: 'Dawn', value: 'dawn' },
                            { title: 'Sunset', value: 'sunset' },
                            { title: 'Night', value: 'night' },
                            { title: 'Forest', value: 'forest' },
                        ]}
                    />
                )}
            </>
        )
    };

    const fogSection = {
        key: 'fog',
        title: 'Fog',
        enabled: enableFog,
        onToggle: (enabled: boolean) => setFogConfig({ enableFog: enabled }),
        rows: [{
            label: 'Near',
            min: 0,
            max: Math.max(10, fogFar),
            step: 0.1,
            get: () => fogNear,
            set: (v: number) => setFogConfig({ fogNear: Math.min(v, fogFar) }),
            format: (v: number) => v.toFixed(2),
        }, {
            label: 'Far',
            min: Math.max(0, fogNear + 0.1),
            max: 5000,
            step: 0.1,
            get: () => fogFar,
            set: (v: number) => setFogConfig({ fogFar: Math.max(v, fogNear + 0.1) }),
            format: (v: number) => v.toFixed(2),
        }],
        extras: (
            <FormField
                fieldKey="fogColor"
                label="Fog Color"
                fieldType="color"
                fieldValue={fogColor}
                onFieldChange={(_, color) => setFogConfig({ fogColor: color as string })}
            />
        )
    };

    return (
        <CollapsibleSection 
            title="Environment" 
            icon={<MdNature size={16} />}
        >
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Background & Environment</div>
                    <FormSchema sections={[backgroundSection]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Fog Settings</div>
                    <FormSchema sections={[fogSection]} />
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default EnvironmentControls;