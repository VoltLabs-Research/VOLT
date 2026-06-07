import { useEditorStore } from '@/modules/canvas/stores/editor';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import type { SceneKeyConfig } from '@/modules/fractal/utilities/scene-utils';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import useSceneInteraction from '../../hooks/use-scene-interaction';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Stack, Surface } from '@voltstack/bravais';

import './ExposureSettingsWidget.css';

const ExposureSettingsWidget = () => {
    const { settingsKey } = useCanvasUrlState();
    const isSceneInteracting = useSceneInteraction();
    const { sceneVisualOverrides, setSceneOpacity } = useEditorStore(useShallow((s) => ({
        sceneVisualOverrides: s.sceneVisualOverrides,
        setSceneOpacity: s.setSceneOpacity
    })));

    const exposureSettingsScene = useMemo<SceneKeyConfig | null>(() => {
        if (!settingsKey) return null;
        if (settingsKey.startsWith('plugin:')) {
            const [, analysisId, exposureId] = settingsKey.split(':');
            if (!analysisId || !exposureId) return null;
            return {
                source: 'plugin',
                sceneType: exposureId,
                analysisId,
                exposureId
            };
        }
        const [source, sceneType] = settingsKey.split(':');
        if (!source || !sceneType) return null;
        return { source, sceneType };
    }, [settingsKey]);

    const sceneKey = exposureSettingsScene ? getSceneKey(exposureSettingsScene) : '';
    const opacity = sceneVisualOverrides[sceneKey]?.opacity ?? 1;

    if (!exposureSettingsScene) return null;

    return (
        <Surface variant='glass' style={{ bottom: '1rem', right: '1rem', top: 'auto', left: 'auto' }} className={`canvas-widget canvas-exposure-widget ${isSceneInteracting ? 'is-dimmed' : ''}`}>
            <Stack gap='05'>
                <FormFieldRHF
                    fieldKey="sceneOpacity"
                    label="Opacity"
                    fieldType="input"
                    fieldValue={opacity}
                    onFieldChange={(_, value) => setSceneOpacity(sceneKey, Number(value))}
                    inputProps={{ type: 'range', min: 0, max: 1, step: 0.01 }}
                />
            </Stack>
        </Surface>
    );
};

export default ExposureSettingsWidget;
