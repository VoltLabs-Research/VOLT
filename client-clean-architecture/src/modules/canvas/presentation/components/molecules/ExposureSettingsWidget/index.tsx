import { useMemo } from 'react';
import { TbSettings, TbX } from 'react-icons/tb';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import FormRow from '@/modules/canvas/presentation/components/atoms/form/FormRow';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import type { SceneObjectType } from '@/modules/canvas/presentation/types/stores/editor/model';
import '@/modules/canvas/presentation/components/molecules/ExposureSettingsWidget/ExposureSettingsWidget.css';

const getSceneKey = (scene: SceneObjectType): string => {
    if (scene.source === 'plugin') {
        return `${scene.source}-${(scene as any).analysisId}-${(scene as any).exposureId}`;
    }
    return `${scene.source}-${scene.sceneType}`;
};

const ExposureSettingsWidget = () => {
    const exposureSettingsScene = useCanvasUIStore((s) => s.exposureSettingsScene);
    const closeExposureSettings = useCanvasUIStore((s) => s.closeExposureSettings);
    const sceneOpacities = useEditorStore((s) => s.sceneOpacities);
    const setSceneOpacity = useEditorStore((s) => s.setSceneOpacity);

    const sceneKey = useMemo(() => {
        if (!exposureSettingsScene) return '';
        return getSceneKey(exposureSettingsScene);
    }, [exposureSettingsScene]);

    const opacity = sceneOpacities[sceneKey] ?? 1.0;

    if (!exposureSettingsScene) return null;

    return (
        <EditorWidget
            style={{ bottom: '1rem', right: '1rem', top: 'auto', left: 'auto' }}
            className='exposure-settings-widget p-1'
            draggable={true}
        >
            <div className='d-flex column w-max'>
                <div className='exposure-settings-widget-header'>
                    <span className='exposure-settings-widget-title gap-05 font-weight-5'>
                        <TbSettings size={14} />
                        Settings
                    </span>
                    <button
                        className='exposure-settings-widget-close cursor-pointer'
                        onClick={closeExposureSettings}
                        type='button'
                    >
                        <TbX size={16} />
                    </button>
                </div>

                <div className='exposure-settings-widget-content gap-05'>
                    <FormRow
                        label='Opacity'
                        value={opacity}
                        onChange={(value: number) => setSceneOpacity(sceneKey, value)}
                        min={0}
                        max={1}
                        step={0.01}
                        format={(v: number) => `${Math.round(v * 100)}%`}
                        className=''
                    />
                </div>
            </div>
        </EditorWidget>
    );
};

export default ExposureSettingsWidget;
