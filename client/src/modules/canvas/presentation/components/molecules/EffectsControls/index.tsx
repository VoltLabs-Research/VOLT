import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import Select from '@/shared/presentation/components/Select';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { MdAutoFixHigh } from 'react-icons/md';
import { valueRow, checkbox } from '../controls/config-helpers';

const EffectsControls = () => {
    const fx = useEditorStore(useShallow((s) => s.effects));

    const sections = [
        {
            key: 'ssao',
            title: 'SSAO(Screen Space Ambient Occlusion)',
            enabled: fx.ssao.enabled,
            onToggle: (enabled: boolean) => fx.setSSAOEffect({ enabled }),
            rows: [
                valueRow({ label: 'Intensity', min: 0, max: 20, step: 0.5, decimals: 2, value: fx.ssao.intensity, onChange: (v) => fx.setSSAOEffect({ intensity: v }) }),
                valueRow({ label: 'Luminance', min: 0, max: 1, step: 0.01, decimals: 2, value: fx.ssao.luminanceInfluence, onChange: (v) => fx.setSSAOEffect({ luminanceInfluence: v }) })
            ]
        },
        {
            key: 'bloom',
            title: 'Bloom',
            enabled: fx.bloom.enabled,
            onToggle: (enabled: boolean) => fx.setBloomEffect({ enabled }),
            rows: [
                valueRow({ label: 'Intensity', min: 0, max: 3, step: 0.1, decimals: 1, value: fx.bloom.intensity, onChange: (v) => fx.setBloomEffect({ intensity: v }) }),
                valueRow({ label: 'Threshold', min: 0, max: 2, step: 0.01, decimals: 2, value: fx.bloom.luminanceThreshold, onChange: (v) => fx.setBloomEffect({ luminanceThreshold: v }) }),
                valueRow({ label: 'Smoothing', min: 0, max: 0.1, step: 0.001, decimals: 3, value: fx.bloom.luminanceSmoothing, onChange: (v) => fx.setBloomEffect({ luminanceSmoothing: v }) })
            ],
            extras: (
                <Select
                    value={String(fx.bloom.kernelSize)}
                    onChange={(v) => fx.setBloomEffect({ kernelSize: Number(v) })}
                    placeholder='Kernel size'
                    options={Array.from({ length: 6 }, (_, i) => ({ title: `${i}`, value: `${i}` }))}
                />
            )
        },
        {
            key: 'chromaticAberration',
            title: 'Chromatic Aberration',
            enabled: fx.chromaticAberration.enabled,
            onToggle: (enabled: boolean) => fx.setChromaticAberration({ enabled }),
            rows: [
                valueRow({ label: 'Offset X', min: -0.01, max: 0.01, step: 0.001, decimals: 3, value: fx.chromaticAberration.offset[0], onChange: (v) => fx.setChromaticAberration({ offset: [v, fx.chromaticAberration.offset[1]] }) }),
                valueRow({ label: 'Offset Y', min: -0.01, max: 0.01, step: 0.001, decimals: 3, value: fx.chromaticAberration.offset[1], onChange: (v) => fx.setChromaticAberration({ offset: [fx.chromaticAberration.offset[0], v] }) })
            ]
        },
        {
            key: 'vignette',
            title: 'Vignette',
            enabled: fx.vignette.enabled,
            onToggle: (enabled: boolean) => fx.setVignette({ enabled }),
            rows: [
                valueRow({ label: 'Offset', min: 0, max: 1, step: 0.01, decimals: 2, value: fx.vignette.offset, onChange: (v) => fx.setVignette({ offset: v }) }),
                valueRow({ label: 'Darkness', min: 0, max: 1, step: 0.01, decimals: 2, value: fx.vignette.darkness, onChange: (v) => fx.setVignette({ darkness: v }) })
            ],
            extras: checkbox('eskil', 'Eskil Mode', fx.vignette.eskil, (v) => fx.setVignette({ eskil: v }))
        },
        {
            key: 'depthOfField',
            title: 'Depth of Field',
            enabled: fx.depthOfField.enabled,
            onToggle: (enabled: boolean) => fx.setDepthOfField({ enabled }),
            rows: [
                valueRow({ label: 'Focus Distance', min: 0.001, max: 1, step: 0.001, decimals: 3, value: fx.depthOfField.focusDistance, onChange: (v) => fx.setDepthOfField({ focusDistance: v }) }),
                valueRow({ label: 'Focal Length', min: 0.1, max: 2, step: 0.01, decimals: 2, value: fx.depthOfField.focalLength, onChange: (v) => fx.setDepthOfField({ focalLength: v }) }),
                valueRow({ label: 'Bokeh Scale', min: 0.1, max: 5, step: 0.1, decimals: 1, value: fx.depthOfField.bokehScale, onChange: (v) => fx.setDepthOfField({ bokehScale: v }) })
            ]
        },
        {
            key: 'sepia',
            title: 'Sepia',
            enabled: fx.sepia.enabled,
            onToggle: (enabled: boolean) => fx.setSepia({ enabled }),
            rows: [
                valueRow({ label: 'Intensity', min: 0, max: 2, step: 0.01, decimals: 2, value: fx.sepia.intensity, onChange: (v) => fx.setSepia({ intensity: v }) })
            ]
        },
        {
            key: 'noise',
            title: 'Noise',
            enabled: fx.noise.enabled,
            onToggle: (enabled: boolean) => fx.setNoise({ enabled }),
            rows: [],
            extras: checkbox('premultiply', 'Premultiply', fx.noise.premultiply, (v) => fx.setNoise({ premultiply: v }))
        }
    ];

    return (
        <SettingsPanel
            title='Post-Processing Effects'
            icon={<MdAutoFixHigh size={16} />}
            subsections={[
                { label: 'SSAO (Screen Space Ambient Occlusion)', sections: [sections[0]] },
                { label: 'Bloom Effect', sections: [sections[1]] },
                { label: 'Chromatic Aberration', sections: [sections[2]] },
                { label: 'Vignette Effect', sections: [sections[3]] },
                { label: 'Depth of Field', sections: [sections[4]] },
                { label: 'Sepia Filter', sections: [sections[5]] },
                { label: 'Noise Effect', sections: [sections[6]] }
            ]}
        />
    );
};

export default memo(EffectsControls);
