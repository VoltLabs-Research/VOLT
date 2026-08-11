import { checkbox, row, selectField } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/store/editor';
import {
    RENDERER_SHADOW_TYPE_OPTIONS,
    RENDERER_SUBSECTION_TITLES,
    RENDERER_TONE_MAPPING_OPTIONS,
    ShadowType,
    ToneMappingMode
} from '@/shared/rendering/renderer';


import { useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { isEnumValue } from '../../utils';

import type { RenderGroup } from '@/modules/canvas/contracts/render-sections';

const useRendererGroup = (): RenderGroup => {
    const rendererSettings = useEditorStore(useShallow((state) => state.rendererSettings));
    const isPointCloudScene = useEditorStore((s) => s.isPointCloudScene);
    const runtime = rendererSettings?.runtime;
    const setRuntime = rendererSettings?.setRuntime;

    return useMemo(() => {
        if (!runtime || !setRuntime) {
            return {
                id: 'renderer',
                title: 'Renderer',
                icon: <SlidersHorizontal size={12} />,
                subsections: []
            };
        }

        const toneSection = {
            key: 'tone',
            title: RENDERER_SUBSECTION_TITLES.toneMapping,
            enabled: true,
            rows: [
                row({
                    label: 'Exposure',
                    min: 0,
                    max: 10,
                    step: 0.1,
                    decimals: 1
                }, () => runtime.toneMappingExposure, (value: number) => {
                    setRuntime({ toneMappingExposure: value });
                })
            ],
            extras: (
                <div className='flex flex-col items-stretch gap-2'>
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
                <div className='flex flex-col items-stretch gap-2'>
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
            icon: <SlidersHorizontal size={12} />,
            subsections: [
                {
                    label: RENDERER_SUBSECTION_TITLES.toneMapping,
                    sections: [toneSection]
                },
                {
                    label: RENDERER_SUBSECTION_TITLES.shadows,
                    sections: [shadowSection],
                    ...(isPointCloudScene
                        ? {
                            disabled: true,
                            disabledReason: 'Not compatible with point cloud scenes'
                        }
                        : {})
                }
            ]
        };
    }, [runtime, setRuntime, isPointCloudScene]);
};

export default useRendererGroup;
