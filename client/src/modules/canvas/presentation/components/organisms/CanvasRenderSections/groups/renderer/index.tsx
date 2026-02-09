import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdTune } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { checkboxWithDescList, selectWithDesc, sliderWithDesc, warningBanner } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';
import type { PrecisionType, ToneMappingMode, OutputCS, ShadowType } from '@/modules/fractal/presentation/types/stores/editor/performance-types';

const useRendererGroup = (): RenderGroup => {
    const { create, runtime, setCreate, setRuntime, reset } = useEditorStore(useShallow((s) => s.rendererSettings));

    return useMemo(() => {
        const contextSection = {
            key: 'context', title: 'WebGL Context (GL Create)', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid canvas-render-grid--md">
                    {warningBanner('Changing these settings will recreate the renderer and reset the scene')}
                    {checkboxWithDescList([
                        { key: 'antialias', label: 'Antialias', description: 'Enable MSAA for smooth geometry edges', value: create.antialias, onChange: (v) => setCreate({ antialias: v }) },
                        { key: 'alpha', label: 'Alpha Channel', description: 'Enable transparency support (RGBA canvas)', value: create.alpha, onChange: (v) => setCreate({ alpha: v }) },
                        { key: 'depth', label: 'Depth Buffer', description: 'Enable Z-buffer for 3D depth testing', value: create.depth, onChange: (v) => setCreate({ depth: v }) },
                        { key: 'stencil', label: 'Stencil Buffer', description: 'Enable stencil operations for masking', value: create.stencil, onChange: (v) => setCreate({ stencil: v }) },
                        { key: 'logDepth', label: 'Logarithmic Depth', description: 'Fix Z-fighting in large scenes with better depth precision', value: create.logarithmicDepthBuffer, onChange: (v) => setCreate({ logarithmicDepthBuffer: v }) },
                        { key: 'preserve', label: 'Preserve Drawing Buffer', description: 'Keep framebuffer between renders (for screenshots)', value: create.preserveDrawingBuffer, onChange: (v) => setCreate({ preserveDrawingBuffer: v }) },
                        { key: 'premultAlpha', label: 'Premultiplied Alpha', description: 'Use premultiplied alpha blending (recommended)', value: create.premultipliedAlpha, onChange: (v) => setCreate({ premultipliedAlpha: v }) },
                        { key: 'failPerf', label: 'Fail Without GPU', description: 'Abort if GPU acceleration unavailable', value: create.failIfMajorPerformanceCaveat, onChange: (v) => setCreate({ failIfMajorPerformanceCaveat: v }) }
                    ])}
                    {selectWithDesc('precision', 'Shader floating-point precision', create.precision, (v) => setCreate({ precision: v as PrecisionType }), 'Shader Precision', [
                        { title: 'High Precision', value: 'highp' },
                        { title: 'Medium Precision', value: 'mediump' },
                        { title: 'Low Precision', value: 'lowp' }
                    ])}
                    <Button variant="ghost" intent="canvas" shape="rounded" size="sm" className="font-size-05" onClick={() => reset()} style={{ justifySelf: 'start' }}>
                        Reset All Settings
                    </Button>
                </Container>
            )
        };

        const toneSection = {
            key: 'tone', title: 'Tone Mapping & Color', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid canvas-render-grid--md">
                    {sliderWithDesc('Exposure', 'Overall scene brightness multiplier', runtime.toneMappingExposure, (v: number) => setRuntime({ toneMappingExposure: v }), { min: 0, max: 10, step: 0.01, decimals: 2 })}
                    {selectWithDesc('toneMapping', 'HDR to LDR conversion algorithm', runtime.toneMapping, (v) => setRuntime({ toneMapping: v as ToneMappingMode }), 'Tone Mapping', [
                        { title: 'None', value: 'None' },
                        { title: 'Linear', value: 'Linear' },
                        { title: 'Reinhard', value: 'Reinhard' },
                        { title: 'Cineon', value: 'Cineon' },
                        { title: 'ACES Filmic', value: 'ACESFilmic' },
                        { title: 'AgX', value: 'AgX' },
                        { title: 'Neutral', value: 'Neutral' }
                    ])}
                    {selectWithDesc('outputColorSpace', 'Output color space for display', runtime.outputColorSpace, (v) => setRuntime({ outputColorSpace: v as OutputCS }), 'Output Color Space', [
                        { title: 'sRGB', value: 'SRGB' },
                        { title: 'Linear sRGB', value: 'LinearSRGB' },
                        { title: 'Display P3', value: 'DisplayP3' },
                        { title: 'Linear Display P3', value: 'LinearDisplayP3' }
                    ])}
                    {sliderWithDesc('Gamma Factor (Legacy)', 'Legacy gamma correction (prefer outputColorSpace)', runtime.gammaFactor, (v: number) => setRuntime({ gammaFactor: v }), { min: 1, max: 3, step: 0.1, decimals: 1 })}
                </Container>
            )
        };

        const shadowSection = {
            key: 'shadows', title: 'Shadow Configuration', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid canvas-render-grid--md">
                    {checkboxWithDescList([
                        { key: 'shadowEnabled', label: 'Enable Shadows', description: 'Enable shadow rendering (performance impact)', value: runtime.shadowEnabled, onChange: (v) => setRuntime({ shadowEnabled: v }) }
                    ])}
                    {selectWithDesc('shadowType', 'Shadow filtering algorithm', runtime.shadowType, (v) => setRuntime({ shadowType: v as ShadowType }), 'Shadow Type', [
                        { title: 'Basic', value: 'Basic' },
                        { title: 'PCF', value: 'PCF' },
                        { title: 'PCF Soft', value: 'PCFSoft' },
                        { title: 'VSM', value: 'VSM' }
                    ])}
                    {checkboxWithDescList([
                        { key: 'shadowAutoUpdate', label: 'Auto Update Shadows', description: 'Update shadows every frame automatically', value: runtime.shadowAutoUpdate, onChange: (v) => setRuntime({ shadowAutoUpdate: v }) }
                    ])}
                </Container>
            )
        };

        const clippingSection = {
            key: 'clipping', title: 'Clipping & Culling', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid canvas-render-grid--md">
                    {checkboxWithDescList([
                        { key: 'localClip', label: 'Local Clipping Planes', description: 'Enable per-material clipping planes', value: runtime.localClippingEnabled, onChange: (v) => setRuntime({ localClippingEnabled: v }) },
                        { key: 'sortObj', label: 'Sort Objects', description: 'Sort objects by depth for proper transparency', value: runtime.sortObjects, onChange: (v) => setRuntime({ sortObjects: v }) }
                    ])}
                </Container>
            )
        };

        const bufferSection = {
            key: 'buffer', title: 'Buffer Clearing', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid canvas-render-grid--md">
                    {checkboxWithDescList([
                        { key: 'autoClear', label: 'Auto Clear (Master)', description: 'Master switch: clear buffers before rendering', value: runtime.autoClear, onChange: (v) => setRuntime({ autoClear: v }) },
                        { key: 'autoClearColor', label: 'Auto Clear Color', description: 'Clear color buffer before rendering', value: runtime.autoClearColor, onChange: (v) => setRuntime({ autoClearColor: v }) },
                        { key: 'autoClearDepth', label: 'Auto Clear Depth', description: 'Clear depth buffer before rendering', value: runtime.autoClearDepth, onChange: (v) => setRuntime({ autoClearDepth: v }) },
                        { key: 'autoClearStencil', label: 'Auto Clear Stencil', description: 'Clear stencil buffer before rendering', value: runtime.autoClearStencil, onChange: (v) => setRuntime({ autoClearStencil: v }) }
                    ])}
                </Container>
            )
        };

        const advancedSection = {
            key: 'advanced', title: 'Advanced Settings', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid canvas-render-grid--md">
                    {checkboxWithDescList([
                        { key: 'legacyLights', label: 'Use Legacy Lights', description: 'Use pre-r155 lighting model', value: runtime.useLegacyLights, onChange: (v) => setRuntime({ useLegacyLights: v }) }
                    ])}
                    {sliderWithDesc('Max Morph Targets', 'Maximum morph targets per mesh (animation)', runtime.maxMorphTargets, (v: number) => setRuntime({ maxMorphTargets: Math.round(v) }), { min: 0, max: 32, step: 1, decimals: 0 })}
                    {sliderWithDesc('Max Morph Normals', 'Maximum morph normals per mesh (lighting)', runtime.maxMorphNormals, (v: number) => setRuntime({ maxMorphNormals: Math.round(v) }), { min: 0, max: 32, step: 1, decimals: 0 })}
                </Container>
            )
        };

        return {
            id: 'renderer', title: 'Renderer',
            icon: <MdTune size={12} />,
            subsections: [
                { label: 'WebGL Context (GL Create)', sections: [contextSection] },
                { label: 'Tone Mapping & Color', sections: [toneSection] },
                { label: 'Shadow Configuration', sections: [shadowSection] },
                { label: 'Clipping & Culling', sections: [clippingSection] },
                { label: 'Buffer Clearing', sections: [bufferSection] },
                { label: 'Advanced Settings', sections: [advancedSection] }
            ]
        };
    }, [create, runtime, setCreate, setRuntime, reset]);
};

export default useRendererGroup;
