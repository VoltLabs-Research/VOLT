import { useEditorStore } from '@/modules/canvas/stores/editor';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import useSceneInteraction from '../../../hooks/use-scene-interaction';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';

import './ExposureSettingsWidget.css';

const ExposureSettingsWidget = () => {
    const { settingsKey } = useCanvasUrlState();
    const isSceneInteracting = useSceneInteraction();
    const { sceneVisualOverrides, setSceneOpacity } = useEditorStore(useShallow((s) => ({
        sceneVisualOverrides: s.sceneVisualOverrides,
        setSceneOpacity: s.setSceneOpacity
    })));

    const exposureSettingsScene = useMemo(() => {
        if (!settingsKey) return null;
        if (settingsKey.startsWith('plugin:')) {
            const [, analysisId, exposureId] = settingsKey.split(':');
            if (!analysisId || !exposureId) return null;
            return {
                source: 'plugin',
                sceneType: exposureId,
                analysisId,
                exposureId
            } as any;
        }
        const [source, sceneType] = settingsKey.split(':');
        if (!source || !sceneType) return null;
        return { source, sceneType } as any;
    }, [settingsKey]);

    const sceneKey = exposureSettingsScene ? getSceneKey(exposureSettingsScene) : '';
    const opacity = sceneVisualOverrides[sceneKey]?.opacity ?? 1;

    if (!exposureSettingsScene) return null;

    return (
        <Container
            style={{ bottom: '1rem', right: '1rem', top: 'auto', left: 'auto' }}
            className={`canvas-widget glass-bg canvas-exposure-widget ${isSceneInteracting ? 'is-dimmed' : ''}`}
        >
            <Container className="d-flex column gap-05">
                <FormFieldRHF
                    fieldKey="sceneOpacity"
                    label="Opacity"
                    fieldType="input"
                    fieldValue={opacity}
                    onFieldChange={(_, value) => setSceneOpacity(sceneKey, Number(value))}
                    inputProps={{ type: 'range', min: 0, max: 1, step: 0.01 }}
                />
            </Container>
        </Container>
    );
};

export default ExposureSettingsWidget;
