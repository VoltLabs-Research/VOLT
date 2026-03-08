import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MdTune } from 'react-icons/md';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import Container from '@/shared/presentation/components/Container';
import { checkbox, selectField } from '../../../../molecules/CanvasRenderConfigHelpers';
import type { RenderGroup } from '../../types';
import type { ToneMappingMode, ShadowType } from '@/modules/fractal/types/stores/editor/performance-types';

const useRendererGroup = (): RenderGroup => {
    const { runtime, setRuntime } = useEditorStore(useShallow((s) => s.rendererSettings));

    return useMemo(() => {
        const toneSection = {
            key: 'tone', title: 'Tone Mapping', enabled: true,
            rows: [],
            extras: (
                <Container className="canvas-render-grid">
                    {selectField('toneMapping', runtime.toneMapping, (v) => setRuntime({ toneMapping: v as ToneMappingMode }), 'Tone Mapping', [
                        { title: 'None', value: 'None' },
                        { title: 'Linear', value: 'Linear' },
                        { title: 'Reinhard', value: 'Reinhard' },
                        { title: 'Cineon', value: 'Cineon' },
                        { title: 'ACES Filmic', value: 'ACESFilmic' },
                        { title: 'AgX', value: 'AgX' },
                        { title: 'Neutral', value: 'Neutral' }
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
                    {selectField('shadowType', runtime.shadowType, (v) => setRuntime({ shadowType: v as ShadowType }), 'Shadow Type', [
                        { title: 'Basic', value: 'Basic' },
                        { title: 'PCF', value: 'PCF' },
                        { title: 'PCF Soft', value: 'PCFSoft' },
                        { title: 'VSM', value: 'VSM' }
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
