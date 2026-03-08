import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdAutoFixHigh } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { valueRow, checkbox } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';

const useEffectsGroup = (): RenderGroup => {
    const fx = useEditorStore(useShallow((s) => s.effects));

    return useMemo(() => {
        const sections = [
            {
                key: 'ssao', title: 'SSAO',
                enabled: fx.ssao.enabled,
                onToggle: (enabled: boolean) => fx.setSSAOEffect({ enabled }),
                rows: [
                    valueRow({ label: 'Intensity', min: 0, max: 20, step: 0.5, decimals: 2, value: fx.ssao.intensity, onChange: (v: number) => fx.setSSAOEffect({ intensity: v }) }),
                    valueRow({ label: 'Luminance', min: 0, max: 1, step: 0.01, decimals: 2, value: fx.ssao.luminanceInfluence, onChange: (v: number) => fx.setSSAOEffect({ luminanceInfluence: v }) })
                ]
            },
            {
                key: 'bloom', title: 'Bloom',
                enabled: fx.bloom.enabled,
                onToggle: (enabled: boolean) => fx.setBloomEffect({ enabled }),
                rows: [
                    valueRow({ label: 'Intensity', min: 0, max: 3, step: 0.1, decimals: 1, value: fx.bloom.intensity, onChange: (v: number) => fx.setBloomEffect({ intensity: v }) }),
                    valueRow({ label: 'Threshold', min: 0, max: 2, step: 0.01, decimals: 2, value: fx.bloom.luminanceThreshold, onChange: (v: number) => fx.setBloomEffect({ luminanceThreshold: v }) }),
                    valueRow({ label: 'Smoothing', min: 0, max: 0.1, step: 0.001, decimals: 3, value: fx.bloom.luminanceSmoothing, onChange: (v: number) => fx.setBloomEffect({ luminanceSmoothing: v }) })
                ]
            },
            {
                key: 'chromaticAberration', title: 'Chromatic Aberration',
                enabled: fx.chromaticAberration.enabled,
                onToggle: (enabled: boolean) => fx.setChromaticAberration({ enabled }),
                rows: [
                    valueRow({ label: 'Offset X', min: -0.01, max: 0.01, step: 0.001, decimals: 3, value: fx.chromaticAberration.offset[0], onChange: (v: number) => fx.setChromaticAberration({ offset: [v, fx.chromaticAberration.offset[1]] }) }),
                    valueRow({ label: 'Offset Y', min: -0.01, max: 0.01, step: 0.001, decimals: 3, value: fx.chromaticAberration.offset[1], onChange: (v: number) => fx.setChromaticAberration({ offset: [fx.chromaticAberration.offset[0], v] }) })
                ]
            },
            {
                key: 'vignette', title: 'Vignette',
                enabled: fx.vignette.enabled,
                onToggle: (enabled: boolean) => fx.setVignette({ enabled }),
                rows: [
                    valueRow({ label: 'Offset', min: 0, max: 1, step: 0.01, decimals: 2, value: fx.vignette.offset, onChange: (v: number) => fx.setVignette({ offset: v }) }),
                    valueRow({ label: 'Darkness', min: 0, max: 1, step: 0.01, decimals: 2, value: fx.vignette.darkness, onChange: (v: number) => fx.setVignette({ darkness: v }) })
                ],
                extras: checkbox('eskil', 'Eskil Mode', fx.vignette.eskil, (v: boolean) => fx.setVignette({ eskil: v }))
            },
            {
                key: 'depthOfField', title: 'Depth of Field',
                enabled: fx.depthOfField.enabled,
                onToggle: (enabled: boolean) => fx.setDepthOfField({ enabled }),
                rows: [
                    valueRow({ label: 'Focus Distance', min: 0.001, max: 1, step: 0.001, decimals: 3, value: fx.depthOfField.focusDistance, onChange: (v: number) => fx.setDepthOfField({ focusDistance: v }) }),
                    valueRow({ label: 'Focal Length', min: 0.1, max: 2, step: 0.01, decimals: 2, value: fx.depthOfField.focalLength, onChange: (v: number) => fx.setDepthOfField({ focalLength: v }) }),
                    valueRow({ label: 'Bokeh Scale', min: 0.1, max: 5, step: 0.1, decimals: 1, value: fx.depthOfField.bokehScale, onChange: (v: number) => fx.setDepthOfField({ bokehScale: v }) })
                ]
            },
            {
                key: 'sepia', title: 'Sepia',
                enabled: fx.sepia.enabled,
                onToggle: (enabled: boolean) => fx.setSepia({ enabled }),
                rows: [
                    valueRow({ label: 'Intensity', min: 0, max: 2, step: 0.01, decimals: 2, value: fx.sepia.intensity, onChange: (v: number) => fx.setSepia({ intensity: v }) })
                ]
            },
            {
                key: 'noise', title: 'Noise',
                enabled: fx.noise.enabled,
                onToggle: (enabled: boolean) => fx.setNoise({ enabled }),
                rows: [],
                extras: checkbox('premultiply', 'Premultiply', fx.noise.premultiply, (v: boolean) => fx.setNoise({ premultiply: v }))
            }
        ];

        return {
            id: 'effects', title: 'Effects',
            icon: <MdAutoFixHigh size={12} />,
            subsections: sections.map((s) => ({ label: s.title, sections: [s] }))
        };
    }, [fx]);
};

export default useEffectsGroup;
