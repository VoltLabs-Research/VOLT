import { useShallow } from 'zustand/react/shallow';
import { TbSettings, TbX } from 'react-icons/tb';
import Draggable from '@/shared/presentation/components/Draggable';
import useSceneInteraction from '@/modules/canvas/presentation/hooks/use-scene-interaction';
import FormRow from '@/modules/canvas/presentation/components/atoms/form/FormRow';
import useCanvasUrlState from '@/modules/canvas/presentation/hooks/use-canvas-url-state';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import type { SceneObjectType } from '@/modules/fractal/presentation/types/stores/editor/scene-types';
import '@/modules/canvas/presentation/components/molecules/ExposureSettingsWidget/ExposureSettingsWidget.css';

const getSceneKey = (scene: SceneObjectType): string => {
    if (scene.source === 'plugin') {
        return `${scene.source}-${(scene as any).analysisId}-${(scene as any).exposureId}`;
    }
    return `${scene.source}-${scene.sceneType}`;
};

const ExposureSettingsWidget = () => {
    const { settingsKey, setSettingsKey } = useCanvasUrlState();
    const isSceneInteracting = useSceneInteraction();
    const { sceneOpacities, setSceneOpacity } = useEditorStore(useShallow((s) => ({
        sceneOpacities: s.sceneOpacities,
        setSceneOpacity: s.setSceneOpacity
    })));

    const parseScene = (value: string | null): SceneObjectType | null => {
        if (!value) return null;
        if (value.startsWith('plugin:')) {
            const [, analysisId, exposureId] = value.split(':');
            if (!analysisId || !exposureId) return null;
            return {
                source: 'plugin',
                sceneType: exposureId,
                analysisId,
                exposureId
            } as any;
        }
        const [source, sceneType] = value.split(':');
        if (!source || !sceneType) return null;
        return { source, sceneType } as any;
    };

    const exposureSettingsScene = parseScene(settingsKey ?? null);
    const sceneKey = exposureSettingsScene ? getSceneKey(exposureSettingsScene) : '';

    const opacity = sceneOpacities[sceneKey] ?? 1.0;

    if (!exposureSettingsScene) return null;

    return (
        <Draggable
            enabled
            doubleClickToDrag
            axis="both"
            scaleWhileDragging={0.95}
            bounds="parent"
            style={{ bottom: '1rem', right: '1rem', top: 'auto', left: 'auto' }}
            className={`widget-container exposure-settings-widget p-1 ${isSceneInteracting ? 'dimmed' : ''}`}
        >
            <div className='d-flex column w-max'>
                <div className='exposure-settings-widget-header d-flex items-center content-between'>
                    <span className='exposure-settings-widget-title d-flex items-center gap-05 font-weight-5'>
                        <TbSettings size={14} />
                        Settings
                    </span>
                    <button
                        className='exposure-settings-widget-close cursor-pointer d-flex items-center content-center p-025 b-none transition-normal'
                        onClick={() => setSettingsKey(null, { replace: true })}
                        type='button'
                    >
                        <TbX size={16} />
                    </button>
                </div>

                <div className='d-flex column gap-05'>
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
        </Draggable>
    );
};

export default ExposureSettingsWidget;
