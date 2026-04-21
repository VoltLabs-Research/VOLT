import { checkbox, row, selectField } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import {
    RENDERER_SHADOW_TYPE_OPTIONS,
    RENDERER_SUBSECTION_TITLES,
    RENDERER_TONE_MAPPING_OPTIONS,
    ShadowType,
    ToneMappingMode
} from '@/shared/domain/rendering/renderer';

import { useMemo } from 'react';
import { MdTune } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import { isEnumValue } from '../../utilities';

import type { RenderGroup } from '../../types';

const useRendererGroup = (): RenderGroup => {
    const { runtime, setRuntime } = useEditorStore(useShallow((state) => state.rendererSettings));
    const isPointCloudScene = useEditorStore((s) => s.isPointCloudScene);

    return useMemo(() => {
        const toneSection = {
            key: 'tone',
            title: RENDERER_SUBSECTION_TITLES.toneMapping,
            enabled: true,
            rows: [
                row({ label: 'Exposure', min: 0, max: 10, step: 0.1, decimals: 1 }, () => runtime.toneMappingExposure, (value: number) => {
                    setRuntime({ toneMappingExposure: value });
                })
            ],
            extras: (
                <div className='volt-container canvas-render-grid'>
                    {selectField('toneMapping', runtime.toneMapping, (value) => {
                        if (isEnumValue(value, ToneMappingMode)) {
                            setRuntime({ toneMapping: value });
                        }
                    }, 'Tone Mapping', RENDERER_TONE_MAPPING_OPTIONS)}
                </div>
            )
        };

        const shadowSection = {
            key: 'shadows',
            title: RENDERER_SUBSECTION_TITLES.shadows,
            enabled: true,
            rows: [],
            extras: (
                <div className='volt-container canvas-render-grid'>
                    {checkbox('shadowEnabled', 'Enable Shadows', runtime.shadowEnabled, (value) => setRuntime({ shadowEnabled: value }))}
                    {selectField('shadowType', runtime.shadowType, (value) => {
                        if (isEnumValue(value, ShadowType)) {
                            setRuntime({ shadowType: value });
                        }
                    }, 'Shadow Type', RENDERER_SHADOW_TYPE_OPTIONS)}
                </div>
            )
        };

        return {
            id: 'renderer',
            title: 'Renderer',
            icon: <MdTune size={12} />,
            subsections: [
                { label: RENDERER_SUBSECTION_TITLES.toneMapping, sections: [toneSection] },
                {
                    label: RENDERER_SUBSECTION_TITLES.shadows,
                    sections: [shadowSection],
                    ...(isPointCloudScene
                        ? { disabled: true, disabledReason: 'Not compatible with point cloud scenes' }
                        : {})
                }
            ]
        };
    }, [runtime, setRuntime, isPointCloudScene]);
};

export default useRendererGroup;
