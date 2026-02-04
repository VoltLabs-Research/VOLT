import React, { memo } from 'react';
import Select from '@/shared/presentation/components/Select';
import SettingsPanel from '@/modules/canvas/presentation/components/molecules/SettingsPanel';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import Button from '@/shared/presentation/components/Button';
import { MdTune } from 'react-icons/md';
import { checkboxWithDesc, sliderWithDesc, warningBanner } from '../controls/config-helpers';

const RendererSettingsControls: React.FC = () => {
    const { create, runtime, setCreate, setRuntime, reset } = useEditorStore(useShallow((s) => s.rendererSettings));

    const contextSection = {
        key: 'context',
        title: 'WebGL Context (GL Create)',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                {warningBanner('Changing these settings will recreate the renderer and reset the scene')}
                {checkboxWithDesc('antialias', 'Antialias', 'Enable MSAA for smooth geometry edges', create.antialias, (v) => setCreate({ antialias: v }))}
                {checkboxWithDesc('alpha', 'Alpha Channel', 'Enable transparency support (RGBA canvas)', create.alpha, (v) => setCreate({ alpha: v }))}
                {checkboxWithDesc('depth', 'Depth Buffer', 'Enable Z-buffer for 3D depth testing', create.depth, (v) => setCreate({ depth: v }))}
                {checkboxWithDesc('stencil', 'Stencil Buffer', 'Enable stencil operations for masking', create.stencil, (v) => setCreate({ stencil: v }))}
                {checkboxWithDesc('logDepth', 'Logarithmic Depth', 'Fix Z-fighting in large scenes with better depth precision', create.logarithmicDepthBuffer, (v) => setCreate({ logarithmicDepthBuffer: v }))}
                {checkboxWithDesc('preserve', 'Preserve Drawing Buffer', 'Keep framebuffer between renders (for screenshots)', create.preserveDrawingBuffer, (v) => setCreate({ preserveDrawingBuffer: v }))}
                {checkboxWithDesc('premultAlpha', 'Premultiplied Alpha', 'Use premultiplied alpha blending (recommended)', create.premultipliedAlpha, (v) => setCreate({ premultipliedAlpha: v }))}
                {checkboxWithDesc('failPerf', 'Fail Without GPU', 'Abort if GPU acceleration unavailable', create.failIfMajorPerformanceCaveat, (v) => setCreate({ failIfMajorPerformanceCaveat: v }))}
                <div>
                    <Select
                        value={create.precision}
                        onChange={(v) => setCreate({ precision: v as any })}
                        placeholder='Shader Precision'
                        options={[
                            { title: 'High Precision', value: 'highp' },
                            { title: 'Medium Precision', value: 'mediump' },
                            { title: 'Low Precision', value: 'lowp' }
                        ]}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Shader floating-point precision</div>
                </div>
                <Button variant='ghost' intent='neutral' size='sm' onClick={() => reset()} style={{ justifySelf: 'start' }}>
                    Reset All Settings
                </Button>
            </div>
        )
    };

    const toneSection = {
        key: 'tone',
        title: 'Tone Mapping & Color',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                {sliderWithDesc('Exposure', 'Overall scene brightness multiplier', runtime.toneMappingExposure, (v) => setRuntime({ toneMappingExposure: v }), { min: 0, max: 10, step: 0.01, decimals: 2 })}
                <div>
                    <Select
                        value={runtime.toneMapping}
                        onChange={(v) => setRuntime({ toneMapping: v as any })}
                        placeholder='Tone Mapping'
                        options={[
                            { title: 'None', value: 'None' },
                            { title: 'Linear', value: 'Linear' },
                            { title: 'Reinhard', value: 'Reinhard' },
                            { title: 'Cineon', value: 'Cineon' },
                            { title: 'ACES Filmic', value: 'ACESFilmic' },
                            { title: 'AgX', value: 'AgX' },
                            { title: 'Neutral', value: 'Neutral' }
                        ]}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>HDR to LDR conversion algorithm</div>
                </div>
                <div>
                    <Select
                        value={runtime.outputColorSpace}
                        onChange={(v) => setRuntime({ outputColorSpace: v as any })}
                        placeholder='Output Color Space'
                        options={[
                            { title: 'sRGB', value: 'SRGB' },
                            { title: 'Linear sRGB', value: 'LinearSRGB' },
                            { title: 'Display P3', value: 'DisplayP3' },
                            { title: 'Linear Display P3', value: 'LinearDisplayP3' }
                        ]}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Output color space for display</div>
                </div>
                {sliderWithDesc('Gamma Factor (Legacy)', 'Legacy gamma correction (prefer outputColorSpace)', runtime.gammaFactor, (v) => setRuntime({ gammaFactor: v }), { min: 1, max: 3, step: 0.1, decimals: 1 })}
            </div>
        )
    };

    const shadowSection = {
        key: 'shadows',
        title: 'Shadow Configuration',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                {checkboxWithDesc('shadowEnabled', 'Enable Shadows', 'Enable shadow rendering (performance impact)', runtime.shadowEnabled, (v) => setRuntime({ shadowEnabled: v }))}
                <div>
                    <Select
                        value={runtime.shadowType}
                        onChange={(v) => setRuntime({ shadowType: v as any })}
                        placeholder='Shadow Type'
                        options={[
                            { title: 'Basic', value: 'Basic' },
                            { title: 'PCF', value: 'PCF' },
                            { title: 'PCF Soft', value: 'PCFSoft' },
                            { title: 'VSM', value: 'VSM' }
                        ]}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Shadow filtering algorithm</div>
                </div>
                {checkboxWithDesc('shadowAutoUpdate', 'Auto Update Shadows', 'Update shadows every frame automatically', runtime.shadowAutoUpdate, (v) => setRuntime({ shadowAutoUpdate: v }))}
            </div>
        )
    };

    const clippingSection = {
        key: 'clipping',
        title: 'Clipping & Culling',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                {checkboxWithDesc('localClip', 'Local Clipping Planes', 'Enable per-material clipping planes', runtime.localClippingEnabled, (v) => setRuntime({ localClippingEnabled: v }))}
                {checkboxWithDesc('sortObj', 'Sort Objects', 'Sort objects by depth for proper transparency', runtime.sortObjects, (v) => setRuntime({ sortObjects: v }))}
            </div>
        )
    };

    const bufferSection = {
        key: 'buffer',
        title: 'Buffer Clearing',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                {checkboxWithDesc('autoClear', 'Auto Clear (Master)', 'Master switch: clear buffers before rendering', runtime.autoClear, (v) => setRuntime({ autoClear: v }))}
                {checkboxWithDesc('autoClearColor', 'Auto Clear Color', 'Clear color buffer before rendering', runtime.autoClearColor, (v) => setRuntime({ autoClearColor: v }))}
                {checkboxWithDesc('autoClearDepth', 'Auto Clear Depth', 'Clear depth buffer before rendering', runtime.autoClearDepth, (v) => setRuntime({ autoClearDepth: v }))}
                {checkboxWithDesc('autoClearStencil', 'Auto Clear Stencil', 'Clear stencil buffer before rendering', runtime.autoClearStencil, (v) => setRuntime({ autoClearStencil: v }))}
            </div>
        )
    };

    const advancedSection = {
        key: 'advanced',
        title: 'Advanced Settings',
        enabled: true,
        rows: [],
        extras: (
            <div style={{ display: 'grid', gap: 12 }}>
                {checkboxWithDesc('legacyLights', 'Use Legacy Lights', 'Use pre-r155 lighting model (for compatibility)', runtime.useLegacyLights, (v) => setRuntime({ useLegacyLights: v }))}
                {sliderWithDesc('Max Morph Targets', 'Maximum morph targets per mesh (animation)', runtime.maxMorphTargets, (v) => setRuntime({ maxMorphTargets: Math.round(v) }), { min: 0, max: 32, step: 1, decimals: 0 })}
                {sliderWithDesc('Max Morph Normals', 'Maximum morph normals per mesh (lighting)', runtime.maxMorphNormals, (v) => setRuntime({ maxMorphNormals: Math.round(v) }), { min: 0, max: 32, step: 1, decimals: 0 })}
            </div>
        )
    };

    return (
        <SettingsPanel
            title='Renderer Settings'
            icon={<MdTune size={16} />}
            subsections={[
                { label: 'WebGL Context (GL Create)', sections: [contextSection] },
                { label: 'Tone Mapping & Color', sections: [toneSection] },
                { label: 'Shadow Configuration', sections: [shadowSection] },
                { label: 'Clipping & Culling', sections: [clippingSection] },
                { label: 'Buffer Clearing', sections: [bufferSection] },
                { label: 'Advanced Settings', sections: [advancedSection] }
            ]}
        />
    );
};

export default memo(RendererSettingsControls);
