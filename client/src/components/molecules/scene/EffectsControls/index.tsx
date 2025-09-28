import FormField from '@/components/molecules/FormField';
import useEffectsConfigStore from '@/stores/editor/effects-config';
import Select from '@/components/atoms/form/Select';
import FormRow from '@/components/atoms/form/FormRow';
import FormSection from '@/components/atoms/form/FormSection';
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

    return (
        <div className='editor-sidebar-item-container'>
            <div className='editor-sidebar-item-header-container'>
                <h3 className='editor-sidebar-item-header-title'>Post-Processing Effects</h3>
            </div>

            <FormSection
                title='SSAO (Screen Space Ambient Occlusion)'
                enabled={ssao.enabled}
                onToggle={(enabled) => setSSAOEffect({ enabled })}
            >
                <FormRow
                    label='Intensity'
                    min={0}
                    max={20}
                    step={0.5}
                    value={ssao.intensity}
                    onChange={(intensity) => setSSAOEffect({ intensity })}
                    format={(v) => v.toFixed(2)}
                />
                <FormRow
                    label='Luminance'
                    min={0}
                    max={1}
                    step={0.01}
                    value={ssao.luminanceInfluence}
                    onChange={(luminanceInfluence) => setSSAOEffect({ luminanceInfluence })}
                    format={(v) => v.toFixed(2)}
                />
            </FormSection>

            <FormSection
                title='Bloom'
                enabled={bloom.enabled}
                onToggle={(enabled) => setBloomEffect({ enabled })}
            >
                <FormRow
                    label='Intensity'
                    min={0}
                    max={3}
                    step={0.1}
                    value={bloom.intensity}
                    onChange={(intensity) => setBloomEffect({ intensity })}
                    format={(v) => v.toFixed(1)}
                />

                <FormRow
                    label='Threshold'
                    min={0}
                    max={2}
                    step={0.01}
                    value={bloom.luminanceThreshold}
                    onChange={(luminanceThreshold) => setBloomEffect({ luminanceThreshold })}
                    format={(v) => v.toFixed(2)}
                />

                <FormRow
                    label='Smoothing'
                    min={0}
                    max={0.1}
                    step={0.001}
                    value={bloom.luminanceSmoothing}
                    onChange={(luminanceSmoothing) => setBloomEffect({ luminanceSmoothing })}
                    format={(v) => v.toFixed(3)}
                />

                <Select
                    value={bloom.kernelSize}
                    onChange={(value) => setBloomEffect({ kernelSize: Number(value) })}
                    placeholder='Kernel size'
                    options={Array.from({ length: 6 }, (_, i) => ({ title: `${i}`, value: `${i}` }))}
                />
            </FormSection>

            <FormSection
                title='Chromatic Aberration'
                enabled={chromaticAberration.enabled}
                onToggle={(enabled) => setChromaticAberration({ enabled })}
            >
                <FormRow
                    label='Offset X'
                    min={-0.01}
                    max={0.01}
                    step={0.001}
                    value={chromaticAberration.offset[0]}
                    onChange={(x) => setChromaticAberration({ offset: [x, chromaticAberration.offset[1]] })}
                    format={(v) => v.toFixed(3)}
                />
                <FormRow
                    label='Offset Y'
                    min={-0.01}
                    max={0.01}
                    step={0.001}
                    value={chromaticAberration.offset[1]}
                    onChange={(y) => setChromaticAberration({ offset: [chromaticAberration.offset[0], y] })}
                    format={(v) => v.toFixed(3)}
                />
            </FormSection>

            <FormSection
                title='Vignette'
                enabled={vignette.enabled}
                onToggle={(enabled) => setVignette({ enabled })}
            >
                <FormRow
                    label='Offset'
                    min={0}
                    max={1}
                    step={0.01}
                    value={vignette.offset}
                    onChange={(offset) => setVignette({ offset })}
                    format={(v) => v.toFixed(2)}
                    className='effects-slider'
                />

                <FormRow
                    label='Darkness'
                    min={0}
                    max={1}
                    step={0.01}
                    value={vignette.darkness}
                    onChange={(darkness) => setVignette({ darkness })}
                    format={(v) => v.toFixed(2)}
                    className='effects-slider'
                />
                <FormField
                    fieldValue={vignette.eskil}
                    fieldKey='eskil'
                    fieldType='checkbox'
                    label='Eskil Mode'
                    onFieldChange={(_, eskil) => setVignette({ eskil })}
                />
            </FormSection>

            <FormSection
                title='Depth of Field'
                enabled={depthOfField.enabled}
                onToggle={(enabled) => setDepthOfField({ enabled })}
            >
                <FormRow
                    label='Focus Distance'
                    min={0.001}
                    max={1}
                    step={0.001}
                    value={depthOfField.focusDistance}
                    onChange={(focusDistance) => setDepthOfField({ focusDistance })}
                    format={(v) => v.toFixed(3)}
                    className='effects-slider'
                />
                <FormRow
                    label='Focal Length'
                    min={0.1}
                    max={2}
                    step={0.01}
                    value={depthOfField.focalLength}
                    onChange={(focalLength) => setDepthOfField({ focalLength })}
                    format={(v) => v.toFixed(2)}
                    className='effects-slider'
                />
                <FormRow
                    label='Bokeh Scale'
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={depthOfField.bokehScale}
                    onChange={(bokehScale) => setDepthOfField({ bokehScale })}
                    format={(v) => v.toFixed(1)}
                    className='effects-slider'
                />
            </FormSection>

            <FormSection
                title='Sepia'
                enabled={sepia.enabled}
                onToggle={(enabled) => setSepia({ enabled })}
            >
                <FormRow
                    label='Intensity'
                    min={0}
                    max={2}
                    step={0.01}
                    value={sepia.intensity}
                    onChange={(intensity) => setSepia({ intensity })}
                    format={(v) => v.toFixed(2)}
                    className='effects-slider'
                />
            </FormSection>

            <FormSection
                title='Noise'
                enabled={noise.enabled}
                onToggle={(enabled) => setNoise({ enabled })}
            >
                <FormField
                    fieldValue={noise.premultiply}
                    fieldKey='premultiply'
                    fieldType='checkbox'
                    label='Premultiply'
                    onFieldChange={(_, premultiply) => setNoise({ premultiply })}
                />
            </FormSection>
        </div>
    );
};

export default EffectsControls;