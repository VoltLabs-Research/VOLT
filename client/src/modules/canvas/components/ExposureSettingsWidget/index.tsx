import { cn } from '@heroui/react';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import type { SceneKeyConfig } from '@/modules/fractal/utils/scene-utils';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import useSceneInteraction from '../../hooks/use-scene-interaction';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';

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
        return {
            source,
            sceneType
        };
    }, [settingsKey]);

    const sceneKey = exposureSettingsScene ? getSceneKey(exposureSettingsScene) : '';
    const opacity = sceneVisualOverrides[sceneKey]?.opacity ?? 1;

    if (!exposureSettingsScene) return null;

    return (
        <div className={cn('bg-surface border border-border', `canvas-widget canvas-exposure-widget ${isSceneInteracting ? 'is-dimmed' : ''}`)} style={{
            bottom: '1rem',
            right: '1rem',
            top: 'auto',
            left: 'auto'
        }}>
            <div className='flex flex-col gap-2'>
                <FormFieldRHF
                    fieldKey="sceneOpacity"
                    label="Opacity"
                    fieldType="input"
                    fieldValue={opacity}
                    onFieldChange={(_, value) => setSceneOpacity(sceneKey, Number(value))}
                    inputProps={{
                        type: 'range',
                        min: 0,
                        max: 1,
                        step: 0.01
                    }}
                />
            </div>
        </div>
    );
};

export default ExposureSettingsWidget;
