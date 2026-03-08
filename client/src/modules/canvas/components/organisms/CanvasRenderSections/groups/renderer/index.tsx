import { checkbox, selectField } from '../../../../molecules/CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useMemo } from 'react';
import { MdTune } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';
import Container from '@/shared/presentation/components/Container';
import { ShadowType, ToneMappingMode } from '@/modules/fractal/stores/contracts/editor/performance-types';
import { isEnumValue } from '../../utilities';

import type { RenderGroup } from '../../types';

const useRendererGroup = (): RenderGroup => {
    const { runtime, setRuntime } = useEditorStore(useShallow((s) => s.rendererSettings));

    return useMemo(() => {
        const toneSection = {
            key: 'tone', title: 'Tone Mapping', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid">
                    {selectField('toneMapping', runtime.toneMapping, (value) => {
                        if (isEnumValue(value, ToneMappingMode)) {
                            setRuntime({ toneMapping: value });
                        }
                    }, 'Tone Mapping', [
                        { title: 'None', value: ToneMappingMode.None },
                        { title: 'Linear', value: ToneMappingMode.Linear },
                        { title: 'Reinhard', value: ToneMappingMode.Reinhard },
                        { title: 'Cineon', value: ToneMappingMode.Cineon },
                        { title: 'ACES Filmic', value: ToneMappingMode.ACESFilmic },
                        { title: 'AgX', value: ToneMappingMode.AgX },
                        { title: 'Neutral', value: ToneMappingMode.Neutral }
                    ])}
                </Container>
            )
        };

        const shadowSection = {
            key: 'shadows', title: 'Shadows', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid">
                    {checkbox('shadowEnabled', 'Enable Shadows', runtime.shadowEnabled, (v) => setRuntime({ shadowEnabled: v }))}
                    {selectField('shadowType', runtime.shadowType, (value) => {
                        if (isEnumValue(value, ShadowType)) {
                            setRuntime({ shadowType: value });
                        }
                    }, 'Shadow Type', [
                        { title: 'Basic', value: ShadowType.Basic },
                        { title: 'PCF', value: ShadowType.PCF },
                        { title: 'PCF Soft', value: ShadowType.PCFSoft },
                        { title: 'VSM', value: ShadowType.VSM }
                    ])}
                </Container>
            )
        };

        return {
            id: 'renderer', title: 'Renderer',
            icon: <MdTune size={12} />,
            subsections: [
                { label: 'Tone Mapping', sections: [toneSection] },
                { label: 'Shadows', sections: [shadowSection] }
            ]
        };
    }, [runtime]);
};

export default useRendererGroup;
