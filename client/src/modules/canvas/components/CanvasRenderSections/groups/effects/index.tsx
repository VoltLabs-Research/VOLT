import { checkbox, valueRow } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import {
    EFFECT_SECTION_ORDER,
    EFFECT_SECTION_TITLES,
    EffectSectionId
} from '@/shared/domain/rendering/effects';

import { useMemo } from 'react';
import { MdAutoFixHigh } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';

import type { RenderGroup } from '../../types';

const useEffectsGroup = (): RenderGroup => {
    const effects = useEditorStore(useShallow((state) => state.effects));
    const isPointCloudScene = useEditorStore((s) => s.isPointCloudScene);

    return useMemo(() => {
        const sectionsById = {
            [EffectSectionId.SSAO]: {
                key: EffectSectionId.SSAO,
                title: EFFECT_SECTION_TITLES[EffectSectionId.SSAO],
                enabled: effects.ssao.enabled,
                onToggle: (enabled: boolean) => effects.setSSAOEffect({ enabled }),
                rows: [
                    valueRow({ label: 'Intensity', min: 0, max: 20, step: 0.5, decimals: 2, value: effects.ssao.intensity, onChange: (value: number) => effects.setSSAOEffect({ intensity: value }) }),
                    valueRow({ label: 'Luminance', min: 0, max: 1, step: 0.01, decimals: 2, value: effects.ssao.luminanceInfluence, onChange: (value: number) => effects.setSSAOEffect({ luminanceInfluence: value }) })
                ]
            },
            [EffectSectionId.Bloom]: {
                key: EffectSectionId.Bloom,
                title: EFFECT_SECTION_TITLES[EffectSectionId.Bloom],
                enabled: effects.bloom.enabled,
                onToggle: (enabled: boolean) => effects.setBloomEffect({ enabled }),
                rows: [
                    valueRow({ label: 'Intensity', min: 0, max: 3, step: 0.1, decimals: 1, value: effects.bloom.intensity, onChange: (value: number) => effects.setBloomEffect({ intensity: value }) }),
                    valueRow({ label: 'Threshold', min: 0, max: 2, step: 0.01, decimals: 2, value: effects.bloom.luminanceThreshold, onChange: (value: number) => effects.setBloomEffect({ luminanceThreshold: value }) }),
                    valueRow({ label: 'Smoothing', min: 0, max: 0.1, step: 0.001, decimals: 3, value: effects.bloom.luminanceSmoothing, onChange: (value: number) => effects.setBloomEffect({ luminanceSmoothing: value }) })
                ]
            },
            [EffectSectionId.ChromaticAberration]: {
                key: EffectSectionId.ChromaticAberration,
                title: EFFECT_SECTION_TITLES[EffectSectionId.ChromaticAberration],
                enabled: effects.chromaticAberration.enabled,
                onToggle: (enabled: boolean) => effects.setChromaticAberration({ enabled }),
                rows: [
                    valueRow({ label: 'Offset X', min: -0.01, max: 0.01, step: 0.001, decimals: 3, value: effects.chromaticAberration.offset[0], onChange: (value: number) => effects.setChromaticAberration({ offset: [value, effects.chromaticAberration.offset[1]] }) }),
                    valueRow({ label: 'Offset Y', min: -0.01, max: 0.01, step: 0.001, decimals: 3, value: effects.chromaticAberration.offset[1], onChange: (value: number) => effects.setChromaticAberration({ offset: [effects.chromaticAberration.offset[0], value] }) })
                ]
            },
            [EffectSectionId.Vignette]: {
                key: EffectSectionId.Vignette,
                title: EFFECT_SECTION_TITLES[EffectSectionId.Vignette],
                enabled: effects.vignette.enabled,
                onToggle: (enabled: boolean) => effects.setVignette({ enabled }),
                rows: [
                    valueRow({ label: 'Offset', min: 0, max: 1, step: 0.01, decimals: 2, value: effects.vignette.offset, onChange: (value: number) => effects.setVignette({ offset: value }) }),
                    valueRow({ label: 'Darkness', min: 0, max: 1, step: 0.01, decimals: 2, value: effects.vignette.darkness, onChange: (value: number) => effects.setVignette({ darkness: value }) })
                ],
                extras: checkbox('eskil', 'Eskil Mode', effects.vignette.eskil, (value: boolean) => effects.setVignette({ eskil: value }))
            },
            [EffectSectionId.DepthOfField]: {
                key: EffectSectionId.DepthOfField,
                title: EFFECT_SECTION_TITLES[EffectSectionId.DepthOfField],
                enabled: effects.depthOfField.enabled,
                onToggle: (enabled: boolean) => effects.setDepthOfField({ enabled }),
                rows: [
                    valueRow({ label: 'Focus Distance', min: 0.001, max: 1, step: 0.001, decimals: 3, value: effects.depthOfField.focusDistance, onChange: (value: number) => effects.setDepthOfField({ focusDistance: value }) }),
                    valueRow({ label: 'Focal Length', min: 0.1, max: 2, step: 0.01, decimals: 2, value: effects.depthOfField.focalLength, onChange: (value: number) => effects.setDepthOfField({ focalLength: value }) }),
                    valueRow({ label: 'Bokeh Scale', min: 0.1, max: 5, step: 0.1, decimals: 1, value: effects.depthOfField.bokehScale, onChange: (value: number) => effects.setDepthOfField({ bokehScale: value }) })
                ]
            },
            [EffectSectionId.Sepia]: {
                key: EffectSectionId.Sepia,
                title: EFFECT_SECTION_TITLES[EffectSectionId.Sepia],
                enabled: effects.sepia.enabled,
                onToggle: (enabled: boolean) => effects.setSepia({ enabled }),
                rows: [
                    valueRow({ label: 'Intensity', min: 0, max: 2, step: 0.01, decimals: 2, value: effects.sepia.intensity, onChange: (value: number) => effects.setSepia({ intensity: value }) })
                ]
            },
            [EffectSectionId.Noise]: {
                key: EffectSectionId.Noise,
                title: EFFECT_SECTION_TITLES[EffectSectionId.Noise],
                enabled: effects.noise.enabled,
                onToggle: (enabled: boolean) => effects.setNoise({ enabled }),
                rows: [],
                extras: checkbox('premultiply', 'Premultiply', effects.noise.premultiply, (value: boolean) => effects.setNoise({ premultiply: value }))
            }
        };

        const subsections = EFFECT_SECTION_ORDER.map((sectionId) => ({
            label: EFFECT_SECTION_TITLES[sectionId],
            sections: [sectionsById[sectionId]],
            ...(sectionId === EffectSectionId.SSAO && isPointCloudScene
                ? { disabled: true, disabledReason: 'Not compatible with point cloud scenes' }
                : {})
        }));

        return {
            id: 'effects',
            title: 'Effects',
            icon: <MdAutoFixHigh size={12} />,
            subsections
        };
    }, [effects, isPointCloudScene]);
};

export default useEffectsGroup;
