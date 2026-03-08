import { useEditorStore } from '@/modules/canvas/stores/editor';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import useSceneInteraction from '../../../hooks/use-scene-interaction';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';

import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';

import './ExposureSettingsWidget.css';

const getSceneKey = (scene: SceneObjectType): string => {
    if (scene.source === 'plugin') {
        return `${scene.source}-${(scene as any).analysisId}-${(scene as any).exposureId}`;
    }
    return `${scene.source}-${scene.sceneType}`;
};

const ExposureSettingsWidget = () => {
    const { settingsKey } = useCanvasUrlState();
    const isSceneInteracting = useSceneInteraction();
    const { sceneOpacities, setSceneOpacity } = useEditorStore(useShallow((s) => ({
        sceneOpacities: s.sceneOpacities,
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
    const opacity = sceneOpacities[sceneKey];

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
