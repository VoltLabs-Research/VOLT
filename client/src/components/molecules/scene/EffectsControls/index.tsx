import FormField from '@/components/molecules/FormField';
import useEffectsConfigStore from '@/stores/editor/effects-config';
import Select from '@/components/atoms/form/Select';
import FormRow from '@/components/atoms/form/FormRow';
import FormSection from '@/components/atoms/form/FormSection';
import FormSchema from '@/components/atoms/form/FormSchema';
import CollapsibleSection from '@/components/atoms/CollapsibleSection';
import { MdAutoFixHigh } from 'react-icons/md';
import './EffectsControls.css';

const EffectsControls = () => {
    const {
        ssao,
        bloom,
        chromaticAberration,
        vignette,
        depthOfField,
        noise,
        sepia,
        setSSAOEffect,
        setBloomEffect,
        setChromaticAberration,
        setVignette,
        setDepthOfField,
        setNoise,
        setSepia
    } = useEffectsConfigStore();
    const sections = [
        {
            key: 'ssao',
            title: 'SSAO (Screen Space Ambient Occlusion)',
            enabled: ssao.enabled,
            onToggle: (enabled: boolean) => setSSAOEffect({ enabled }),
            rows: [
                {
                    label: 'Intensity', 
                    min: 0, 
                    max: 20, 
                    step: 0.5,
                    value: ssao.intensity,
                    onChange: (intensity: number) => setSSAOEffect({ intensity }),
                    format: (v: number) => v.toFixed(2)
                },
                {
                    label: 'Luminance', min: 0, max: 1, step: 0.01,
                    value: ssao.luminanceInfluence,
                    onChange: (luminanceInfluence: number) => setSSAOEffect({ luminanceInfluence }),
                    format: (v: number) => v.toFixed(2)
                }
            ]
        },
        {
            key: 'bloom',
            title: 'Bloom',
            enabled: bloom.enabled,
            onToggle: (enabled: boolean) => setBloomEffect({ enabled }),
            rows: [
                {
                    label: 'Intensity',
                    min: 0, 
                    max: 3, 
                    step: 0.1,
                    value: bloom.intensity,
                    onChange: (intensity: number) => setBloomEffect({ intensity }),
                    format: (v: number) => v.toFixed(1)
                },
                {
                    label: 'Threshold', 
                    min: 0, 
                    max: 2, 
                    step: 0.01,
                    value: bloom.luminanceThreshold,
                    onChange: (luminanceThreshold: number) => setBloomEffect({ luminanceThreshold }),
                    format: (v: number) => v.toFixed(2)
                },
                {
                    label: 'Smoothing', 
                    min: 0, 
                    max: 0.1, 
                    step: 0.001,
                    value: bloom.luminanceSmoothing,
                    onChange: (luminanceSmoothing: number) => setBloomEffect({ luminanceSmoothing }),
                    format: (v: number) => v.toFixed(3)
                }
            ],
            extras: (
                <Select
                    value={bloom.kernelSize}
                    onChange={(value) => setBloomEffect({ kernelSize: Number(value) })}
                    placeholder="Kernel size"
                    options={Array.from({ length: 6 }, (_, i) => ({ title: `${i}`, value: `${i}` }))}
                />
            )
        },
        {
            key: 'chromaticAberration',
            title: 'Chromatic Aberration',
            enabled: chromaticAberration.enabled,
            onToggle: (enabled: boolean) => setChromaticAberration({ enabled }),
            rows: [
                {
                    label: 'Offset X', 
                    min: -0.01, 
                    max: 0.01, 
                    step: 0.001,
                    value: chromaticAberration.offset[0],
                    onChange: (x: number) => setChromaticAberration({ offset: [x, chromaticAberration.offset[1]] }),
                    format: (v: number) => v.toFixed(3)
                },
                {
                    label: 'Offset Y', 
                    min: -0.01, 
                    max: 0.01, 
                    step: 0.001,
                    value: chromaticAberration.offset[1],
                    onChange: (y: number) => setChromaticAberration({ offset: [chromaticAberration.offset[0], y] }),
                    format: (v: number) => v.toFixed(3)
                }
            ]
        },
        {
            key: 'vignette',
            title: 'Vignette',
            enabled: vignette.enabled,
            onToggle: (enabled: boolean) => setVignette({ enabled }),
            rows: [
                {
                    label: 'Offset', 
                    min: 0, 
                    max: 1, 
                    step: 0.01,
                    value: vignette.offset,
                    onChange: (offset: number) => setVignette({ offset }),
                    format: (v: number) => v.toFixed(2)
                },
                {
                    label: 'Darkness', 
                    min: 0, 
                    max: 1, 
                    step: 0.01,
                    value: vignette.darkness,
                    onChange: (darkness: number) => setVignette({ darkness }),
                    format: (v: number) => v.toFixed(2)
                }
            ],
            extras: (
                <FormField
                    fieldValue={vignette.eskil}
                    fieldKey="eskil"
                    fieldType="checkbox"
                    label="Eskil Mode"
                    onFieldChange={(_, eskil) => setVignette({ eskil })}
                />
            )
        },
        {
            key: 'depthOfField',
            title: 'Depth of Field',
            enabled: depthOfField.enabled,
            onToggle: (enabled: boolean) => setDepthOfField({ enabled }),
            rows: [
                {
                    label: 'Focus Distance', 
                    min: 0.001, 
                    max: 1, 
                    step: 0.001,
                    value: depthOfField.focusDistance,
                    onChange: (focusDistance: number) => setDepthOfField({ focusDistance }),
                    format: (v: number) => v.toFixed(3)
                },
                {
                    label: 'Focal Length', 
                    min: 0.1, 
                    max: 2, 
                    step: 0.01,
                    value: depthOfField.focalLength,
                    onChange: (focalLength: number) => setDepthOfField({ focalLength }),
                    format: (v: number) => v.toFixed(2)
                },
                {
                    label: 'Bokeh Scale', 
                    min: 0.1, 
                    max: 5, 
                    step: 0.1,
                    value: depthOfField.bokehScale,
                    onChange: (bokehScale: number) => setDepthOfField({ bokehScale }),
                    format: (v: number) => v.toFixed(1)
                }
            ]
        },
        {
            key: 'sepia',
            title: 'Sepia',
            enabled: sepia.enabled,
            onToggle: (enabled: boolean) => setSepia({ enabled }),
            rows: [
                {
                    label: 'Intensity', 
                    min: 0, 
                    max: 2,
                    step: 0.01,
                    value: sepia.intensity,
                    onChange: (intensity: number) => setSepia({ intensity }),
                    format: (v: number) => v.toFixed(2)
                }
            ]
        },
        {
            key: 'noise',
            title: 'Noise',
            enabled: noise.enabled,
            onToggle: (enabled: boolean) => setNoise({ enabled }),
            rows: [],
            extras: (
                <FormField
                    fieldValue={noise.premultiply}
                    fieldKey="premultiply"
                    fieldType="checkbox"
                    label="Premultiply"
                    onFieldChange={(_, premultiply) => setNoise({ premultiply })}
                />
            )
        }
    ];

    return (
        <CollapsibleSection 
            title="Post-Processing Effects" 
            icon={<MdAutoFixHigh size={16} />}
        >
            <div style={{ display: 'grid', gap: 12 }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>SSAO (Screen Space Ambient Occlusion)</div>
                    <FormSchema sections={[sections[0]]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Bloom Effect</div>
                    <FormSchema sections={[sections[1]]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Chromatic Aberration</div>
                    <FormSchema sections={[sections[2]]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Vignette Effect</div>
                    <FormSchema sections={[sections[3]]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Depth of Field</div>
                    <FormSchema sections={[sections[4]]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Sepia Filter</div>
                    <FormSchema sections={[sections[5]]} />
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Noise Effect</div>
                    <FormSchema sections={[sections[6]]} />
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default EffectsControls;