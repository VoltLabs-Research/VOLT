import { formatLegendValue, getVerticalGradientCss } from '../../utilities/gradient-legend';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { Stack, Text } from '@voltstack/bravais';
import { useMemo } from 'react';

import type { ColorCodingScene, SceneObjectType } from '@/modules/fractal/api/entities/scene';

import './ColorbarLegend.css';

const isColorCodingScene = (scene: SceneObjectType): scene is ColorCodingScene => {
    return scene.source === 'color-coding';
};

const formatBound = (raw: string): string => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? formatLegendValue(parsed) : raw;
};

const legendKey = (scene: ColorCodingScene): string => {
    return `${scene.exposureId}:${scene.property}:${scene.gradient}:${scene.startValue}:${scene.endValue}`;
};

const ColorbarLegend = () => {
    const activeScenes = useEditorStore((state) => state.activeScenes);
    const colorCodingScenes = useMemo(() => activeScenes.filter(isColorCodingScene), [activeScenes]);

    if (colorCodingScenes.length === 0) {
        return null;
    }

    return (
        <Stack gap='075' className='canvas-colorbar-legend'>
            {colorCodingScenes.map((scene) => {
                const gradientCss = getVerticalGradientCss(scene.gradient);
                if (!gradientCss) {
                    return null;
                }

                return (
                    <Stack key={legendKey(scene)} gap='025' align='center' className='canvas-colorbar-legend-item'>
                        <Text size='xs' className='canvas-colorbar-legend-value'>{formatBound(scene.endValue)}</Text>
                        <div className='canvas-colorbar-legend-bar' style={{ background: gradientCss }} />
                        <Text size='xs' className='canvas-colorbar-legend-value'>{formatBound(scene.startValue)}</Text>
                        <Text size='xs' className='canvas-colorbar-legend-property'>{scene.property}</Text>
                    </Stack>
                );
            })}
        </Stack>
    );
};

export default ColorbarLegend;
